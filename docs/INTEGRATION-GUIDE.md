# Integration guide — for the clinic's system (SERVER A)

This is a plain-language walkthrough of how your system talks to the patient
portal. If you want the exhaustive technical reference (every field, every
error code, full examples) that's **[docs/API.md](API.md)** — this document is
the shorter "what do I actually do" version.

## The big picture

Your system (we'll call it **SERVER A** — your LIS/HIS, registration desk
software, whatever generates patient records and report PDFs) talks to the
patient portal (**SERVER B**, this app) by calling two endpoints, in order,
for every patient:

```
1. You send us a patient ID  ──────▶  We send back a username + password
                                        (save these — we can't show them again)

2. You send us patientID + PDF ────▶  We send back a QR code
   (whenever a report is ready)        (we store the PDF on our end)
```

You always call us. We never call you. This works even if your network has no
outbound path reachable from us — as long as you can make an HTTPS request
out to us, both steps work.

Every request needs one header, on both endpoints:

```
Authorization: Bearer <INTEGRATION_API_KEY>
```

(Ask whoever manages this app's deployment for the actual key value — it's
an environment variable, `INTEGRATION_API_KEY`, not something in this repo.)

---

## Step 1 — Register the patient

**Call this once per patient**, the first time they need portal access — e.g.
when they're registered at the clinic, or the first time you're about to send
them a report and they don't have an account yet.

```
POST /api/integration/patients
Authorization: Bearer <INTEGRATION_API_KEY>
Content-Type: application/json

{
  "patientId": "PAT-2026-0200",
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+213 555 00 11 22",
  "dateOfBirth": "1990-05-15",
  "gender": "Female"
}
```

Only `patientId` and `fullName` are required (for a brand-new patient).
`patientId` is **your** own identifier for this patient — whatever format
your system already uses (3–60 characters, letters/numbers/dashes). We never
generate this one; you own it.

### What you get back

```json
{
  "patientId": "PAT-2026-0200",
  "username": "k7mXq2wR",
  "fullName": "Jane Doe",
  "password": "b8WD2Zmy",
  "created": true
}
```

`username` and `password` are what the patient actually types in to sign in
to the portal — two short, 8-character codes, deliberately simple to read off
a printout and type back in. They have **nothing to do with `patientId`** —
`patientId` is just your internal record link, it doesn't work as a login.

### Save this response. Immediately. You will not get it again.

This is the important part: **we hash the password the moment we store it.**
There is no "view password" feature anywhere in this app, for anyone —
not you, not us, not an admin. The plaintext password exists for exactly one
moment: right here, in this one API response. Once your system has read it,
it is gone from our side forever.

So, in practice:
- Save `username` + `password` to your own system alongside the patient's
  record.
- Print them on the patient's paperwork, hand them over however you normally
  distribute account credentials — that part is entirely up to you.
- If a patient later loses their password, recovery is handled outside this
  version of Server B. Calling this endpoint again does not rotate or reveal it.

### Repeating the request for an existing patient

If your system is unsure whether the first request succeeded, it can safely call
the endpoint again with just the `patientId`:

```json
{ "patientId": "PAT-2026-0200" }
```

For an existing patient, Server B returns the existing username and
`"created": false`. It does not generate, change, or return a password. This
makes network retries idempotent.

---

## Step 2 — Deliver a report

**Call this whenever a report PDF is ready** — one at a time, or batched up
to 10 reports per call. The normal clinic burst of 5–7 reports fits in one
request. The patient must already
be registered (step 1) — if we don't recognize the `patientId`, that report
is rejected with an error (see below), but the rest of the batch still goes
through.

This request looks different from step 1 because you're sending an actual
file (the PDF), not just text data. You can't put raw binary bytes inside a
JSON body, so this uses a different format called **`multipart/form-data`**
— the same mechanism a plain HTML form uses when it has a file-upload field.
Practically, this means: instead of one JSON blob, the request body is split
into several **named parts**. Some parts are text (the metadata), one part
per report is the actual PDF file — often called a "blob" in JavaScript/web
contexts, meaning a chunk of raw binary data with no particular text
encoding. Every mainstream HTTP client library (curl, Python `requests`,
Node's `fetch`/`FormData`, Java's `HttpClient`, .NET's `HttpClient`, etc.) has
built-in support for building this kind of request — you don't need to
hand-construct anything, just tell your library "here's a file field."

### The two kinds of parts

1. **One part named `metadata`** — a single JSON array, one entry per report
   in this batch:

   ```json
   [
     {
       "patientId": "PAT-2026-0200",
       "externalId": "A-88213",
       "title": "Complete Blood Count",
       "category": "Hematology",
       "collectedAt": "2026-06-14",
       "physician": "Dr. S. Haddad",
       "specimen": "Whole blood (EDTA)",
       "notes": "optional"
     }
   ]
   ```

   | Field | Required | What it is |
   |---|---|---|
   | `patientId` | yes | Must match a patient already registered in step 1 |
   | `externalId` | yes | **Your own** document id for this report — ties this metadata entry to its file part (see below), and lets you safely resend the same report later (see "Resending" below) |
   | `title` | yes | Shown to the patient as the report name |
   | `category` | no | e.g. "Hematology" — defaults to "Clinic report" if you leave it out |
   | `collectedAt` | yes | Date the sample was collected (ISO format, e.g. `2026-06-14`) |
   | `physician`, `specimen`, `notes` | no | Free text, shown in the report detail |

2. **One file part per report**, named `file:<externalId>` — literally the
   word `file:` followed by that report's `externalId` from the metadata
   above. So if `externalId` is `A-88213`, the file part is named
   `file:A-88213`, and it should be the raw PDF bytes for that specific
   report. This naming is how we match each PDF to its metadata entry — the
   parts don't need to arrive in any particular order.

Each PDF must be under 25MB, total PDF data must stay under 100MB, and each file
must be an actual PDF (we check for the standard `%PDF-` file header). Anything
else is rejected without failing the remaining valid items.

### What you get back

Always a `200` response if the request itself was well-formed — individual
reports can still fail without sinking the whole batch, so check the
`status` field of each item:

```json
{
  "results": [
    {
      "externalId": "A-88213",
      "patientId": "PAT-2026-0200",
      "status": "stored",
      "qrGenerated": true,
      "qr": {
        "publicId": "RPT-7K4MX2",
        "url": "https://your-domain/r/RPT-7K4MX2#t=<opaque-secret>",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
        "expiresAt": "2026-08-22T10:15:00.000Z"
      }
    },
    {
      "externalId": "A-88214",
      "patientId": "PAT-2026-0311",
      "status": "error",
      "qrGenerated": false,
      "error": "Unknown patientId — provision the patient via /api/integration/patients first."
    }
  ]
}
```

For every successfully stored report, `qr.svg` is a **ready-to-print SVG
image** of a QR code. Print it directly on the physical report. When a
patient scans it, they see just that one PDF — instantly, with no login —
on their phone. It stops working automatically after 30 days, or sooner if
you ask us to revoke it. It doesn't reveal the patient's username, password,
or any other report — just that one file.

On our end, once a report comes in successfully: we save the PDF to our own
storage, record the report's details against the matching patient, and mint
that QR code. Nothing further is required from you for that report — the
patient can now also see it by logging into the portal directly.

### Resending the same report

If you ever need to resend a report (e.g. a retry after a network error,
or a corrected version) — just send it again with the **same `externalId`**.
We treat that as an update, not a duplicate: the same report entry is refreshed
with the replacement file and metadata, the previous unreferenced PDF is removed,
and a fresh QR code is minted. Nothing gets double-counted in the patient's
history.

---

## Cheat sheet

| | Step 1 — register | Step 2 — deliver |
|---|---|---|
| **Endpoint** | `POST /api/integration/patients` | `POST /api/integration/reports` |
| **When** | Once per patient, before their first report | Every time a report is ready |
| **Body type** | Plain JSON | `multipart/form-data` (metadata + PDF file part) |
| **You get back** | `username` + `password` (once — save it) | A QR code per report (SVG, ready to print) |
| **Prerequisite** | None | Patient must already be registered |

## If something goes wrong

- **`401 Invalid API key`** — the Bearer token doesn't match. Double-check
  the key you were given.
- **`404` on step 1** — you sent a `patientId` we've never seen, without a
  `fullName`. Include `fullName` if this is genuinely a new patient.
  Otherwise, check the `patientId` for typos.
- **`error` on an individual report in step 2** — that one report failed
  (often: the patient wasn't registered yet, or the file wasn't a valid
  PDF) but the rest of the batch still went through — check each item's
  `status` field.
- **`413`** — the request exceeded 100MB of PDF data; split it into smaller batches.
- **`429 Rate limit exceeded`** — you're sending faster than 60 requests/min
  from one IP. Slow down and retry after the `Retry-After` header's value
  (in seconds).

For the full field-by-field reference, exact validation rules, and copy-paste
curl/Node.js examples, see **[docs/API.md](API.md)**.
