# Integration guide — for the clinic's system (SERVER A)

This is a plain-language walkthrough of how your system talks to the patient
portal. If you want the exhaustive technical reference (every field, every
error code, full examples) that's **[docs/API.md](API.md)** — this document is
the shorter "what do I actually do" version.

## The big picture

Your system (we'll call it **SERVER A** — your LIS/HIS, registration desk
software, whatever generates patient records and report PDFs) talks to the
patient portal (**SERVER B**, this app) by calling two endpoints — the second
one twice, at two different moments — for every patient:

```
1. You send us a patient ID  ──────▶  We send back a username + password
   (once, at registration)             (save these — we can't show them again)

2. You send us patientID + an        ▶  We send back a QR code
   appointment/accession number         (a report "slot" now exists, with no
   (e.g. at intake — no PDF yet)         PDF yet — scanning the QR shows a
                                          "not ready yet" page)

3. Later, you send us the PDF for    ▶  We send back the SAME QR code
   that same appointment number         (the report is now complete —
                                          scanning that same code now shows
                                          the PDF)
```

Steps 2 and 3 are literally **the same endpoint**,
`POST /api/integration/reports` — whether you attach a file or not is what
decides which of the two happens. If your workflow doesn't have a separate
intake moment, you can also skip straight to step 3: send the PDF the first
time, with no prior step 2 call, and we create and complete the report in one
shot.

You always call us. We never call you. This works even if your network has no
outbound path reachable from us — as long as you can make an HTTPS request
out to us, every step works.

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

### Try it with curl

```bash
KEY="<your INTEGRATION_API_KEY>"

curl -X POST https://cliniqueamina.mobi:8080/api/integration/patients \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "patientId": "PAT-2026-0200",
        "fullName": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+213 555 00 11 22",
        "dateOfBirth": "1990-05-15",
        "gender": "Female"
      }'
```

Swap `https://cliniqueamina.mobi:8080` for the portal's real address (in local dev,
`http://localhost:3000`), and `$KEY` for the actual `INTEGRATION_API_KEY`
value. The response is the JSON shown below, printed straight to your
terminal.

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

## Step 2 — Pre-register the appointment and get the QR

**Call this at intake** — the moment you create the appointment/accession
number (e.g. `LAB-26070424`) for a patient, before the sample has even been
analyzed. This is what lets you print the QR code on the patient's card right
away, alongside their username and password from step 1, like this:

```
┌─────────────────────────┐
│      CLINIQUE AMINA      │
│      PATIENT PORTAL      │
│                           │
│    SNOUSSI SEKKAI         │
│  NIP  PAT-25-16411        │
│  RDV  LAB-26070424 · 26/07/2026 │
│                           │
│   Scan to view results    │
│   [ QR CODE ]             │
│                           │
│   Username: vkCcGpyH      │
│   Password: aBhRaqtB      │
└─────────────────────────┘
```

This is the same endpoint as step 3 (`POST /api/integration/reports`) — the
only difference is you send metadata **without a file part**. The patient
must already be registered (step 1); if we don't recognize the `patientId`,
this is rejected with an error, but the rest of the batch still goes through.

```bash
KEY="<your INTEGRATION_API_KEY>"

curl -X POST https://cliniqueamina.mobi:8080/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"LAB-26070424","collectedAt":"2026-07-26"}]'
```

No file part at all — just the `metadata` field, still wrapped in `[ ]`.
`externalId` is your appointment/accession number; you'll use this exact same
value again in step 3 to attach the PDF. `title` and `category` are optional
here — if you don't know the test type yet, leave them out; we show
"Pending report" in the meantime and you can fill it in later.

### What you get back

```json
{
  "results": [
    {
      "externalId": "LAB-26070424",
      "patientId": "PAT-2026-0200",
      "status": "pending_created",
      "qrGenerated": true,
      "qr": {
        "publicId": "RPT-7K4MX2",
        "url": "https://cliniqueamina.mobi:8080/r/RPT-7K4MX2#t=<opaque-secret>",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
        "expiresAt": "2026-08-25T10:15:00.000Z"
      }
    }
  ]
}
```

`qr.svg` is a **ready-to-print SVG image**. Print it on the card now. Until
the PDF actually arrives (step 3), scanning it shows the patient a "results
aren't ready yet" page — not an error, just a polite wait message.

**This QR does not change later.** Whatever `qr.url` you print now is the
same one that will show the finished PDF once step 3 completes — no reprint,
no reconciling two different codes. Retrying this same call (e.g. because you
weren't sure the first one went through) is safe too: you'll get
`status: "pending_exists"` back with that identical QR, not a new one.

If your workflow doesn't have a distinct intake moment — you only ever send a
report once its PDF already exists — you can skip this step entirely and go
straight to step 3 below; it creates and completes the report in one call.

---

## Step 3 — Attach the PDF once it's ready

**Call this whenever a report PDF is ready** — one at a time, or batched up
to 10 reports per call. The normal clinic burst of 5–7 reports fits in one
request. Same endpoint, same `externalId` as step 2 — this time **with** the
file part attached.

This request looks different from steps 1–2 because you're sending an actual
file (the PDF), not just text data. You can't put raw binary bytes inside a
JSON body, so this uses a format called **`multipart/form-data`** — the same
mechanism a plain HTML form uses when it has a file-upload field.
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
       "externalId": "LAB-26070424",
       "title": "Complete Blood Count",
       "category": "Hematology",
       "collectedAt": "2026-07-26",
       "physician": "Dr. S. Haddad",
       "specimen": "Whole blood (EDTA)",
       "notes": "optional"
     }
   ]
   ```

   | Field | Required | What it is |
   |---|---|---|
   | `patientId` | yes | Must match a patient already registered in step 1 |
   | `externalId` | yes | **Your own** appointment/document id for this report — the same value you used in step 2, if you called it. Ties this metadata entry to its file part (see below), and lets you safely retry the same report later (see "Retrying the same report" below) |
   | `title` | no | Shown to the patient as the report name. If you already set it in step 2, you can leave it out here; if you send it, it overwrites whatever was there |
   | `category` | no | e.g. "Hematology" — defaults to "Clinic report" if never set |
   | `collectedAt` | yes | Date the sample was collected (ISO format, e.g. `2026-07-26`). Only takes effect if this report doesn't already exist; if step 2 already set it, this is ignored |
   | `physician`, `specimen`, `notes` | no | Free text, shown in the report detail |

2. **One file part per report**, named `file:<externalId>` — literally the
   word `file:` followed by that report's `externalId` from the metadata
   above. So if `externalId` is `LAB-26070424`, the file part is named
   `file:LAB-26070424`, and it should be the raw PDF bytes for that specific
   report. This naming is how we match each PDF to its metadata entry — the
   parts don't need to arrive in any particular order.

Each PDF must be under 25MB, total PDF data must stay under 100MB, and each file
must be an actual PDF (we check for the standard `%PDF-` file header). Anything
else is rejected without failing the remaining valid items.

### Try it with curl — one report

```bash
KEY="<your INTEGRATION_API_KEY>"

curl -X POST https://cliniqueamina.mobi:8080/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"LAB-26070424","title":"Complete Blood Count","category":"Hematology","collectedAt":"2026-07-26","physician":"Dr. S. Haddad","specimen":"Whole blood (EDTA)"}]' \
  -F "file:LAB-26070424=@/path/to/LAB-26070424.pdf;type=application/pdf"
```

Two things to get right:

- The `-F 'metadata=[...]'` part is a **JSON array as a string** — even for
  one report, it's still wrapped in `[ ]`. Quote the whole thing so your
  shell doesn't mangle the inner double quotes.
- The `file:` part name must match `externalId` from the metadata **exactly**
  — `file:LAB-26070424`, not `file:lab-26070424` or `file:report1`. That's
  the only thing that links the PDF bytes to its metadata entry.

### Try it with curl — a batch of several reports

Same request, just more metadata entries and one `-F` file part per report:

```bash
curl -X POST https://cliniqueamina.mobi:8080/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[
        {"patientId":"PAT-2026-0200","externalId":"LAB-26070424","title":"Complete Blood Count","category":"Hematology","collectedAt":"2026-07-26"},
        {"patientId":"PAT-2026-0200","externalId":"LAB-26070425","title":"Lipid Panel","category":"Biochemistry","collectedAt":"2026-07-26"}
      ]' \
  -F "file:LAB-26070424=@/path/to/LAB-26070424.pdf;type=application/pdf" \
  -F "file:LAB-26070425=@/path/to/LAB-26070425.pdf;type=application/pdf"
```

Check each item's `status` in the response — one bad report in a batch
(unknown patient, corrupt PDF, etc.) does not fail the others.

### What you get back

Always a `200` response if the request itself was well-formed — individual
reports can still fail without sinking the whole batch, so check the
`status` field of each item:

```json
{
  "results": [
    {
      "externalId": "LAB-26070424",
      "patientId": "PAT-2026-0200",
      "status": "stored",
      "qrGenerated": true,
      "qr": {
        "publicId": "RPT-7K4MX2",
        "url": "https://cliniqueamina.mobi:8080/r/RPT-7K4MX2#t=<opaque-secret>",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
        "expiresAt": "2026-08-25T11:00:00.000Z"
      }
    },
    {
      "externalId": "LAB-26070430",
      "patientId": "PAT-2026-0311",
      "status": "error",
      "qrGenerated": false,
      "error": "Unknown patientId — provision the patient via /api/integration/patients first."
    }
  ]
}
```

Notice `qr.publicId` here (`RPT-7K4MX2`) is the **exact same one** from step
2's example above — if you already printed that card at intake, it now shows
the finished PDF with nothing more to do. If you skipped step 2 for this
report, `status` is still `"stored"` and this is the first time you're seeing
this QR — print it now, same as before.

When a patient scans a report's QR, they see just that one PDF — instantly,
with no login — on their phone. It stops working automatically 30 days after
it was minted (or 30 days after the PDF attached, if that QR started life in
step 2), or sooner if you ask us to revoke it. It doesn't reveal the
patient's username, password, or any other report — just that one file.

On our end, once a report comes in successfully: we save the PDF to our own
storage, record the report's details against the matching patient, and
either mint or reuse that QR code. Nothing further is required from you for
that report — the patient can now also see it by logging into the portal
directly.

### Retrying the same report

If a network error makes you unsure whether we received a report, send the exact
same PDF again with the same **`externalId`**. We compare its SHA-256 fingerprint:

- Identical bytes return `status: "already_stored"` and the same QR as
  before. No duplicate database row or PDF file is created.
- Different bytes return `status: "conflict"` and the original report is not
  changed.

A corrected PDF or any genuinely new report must have a new `externalId`. This
keeps the patient's report history append-only.

**In practice, retrying is just re-running the exact same curl command above**
— same `externalId`, same PDF file. If the bytes match what we already have,
you get `"status": "already_stored"` back instead of an error; nothing is
duplicated. Only send a different `externalId` for an actually different or
corrected document.

---

## Cheat sheet

| | Step 1 — register | Step 2 — pre-register (optional) | Step 3 — deliver |
|---|---|---|---|
| **Endpoint** | `POST /api/integration/patients` | `POST /api/integration/reports` | `POST /api/integration/reports` |
| **When** | Once per patient, before their first report | At intake, before the PDF exists | Whenever the PDF is ready |
| **Body type** | Plain JSON | `multipart/form-data` (metadata only, no file) | `multipart/form-data` (metadata + PDF file part) |
| **You get back** | `username` + `password` (once — save it) | A QR code (SVG, ready to print) — "not ready yet" until step 3 | The same QR code, now showing the finished PDF |
| **Prerequisite** | None | Patient must already be registered | Patient must already be registered; step 2 optional |

## If something goes wrong

- **`401 Invalid API key`** — the Bearer token doesn't match. Double-check
  the key you were given.
- **`404` on step 1** — you sent a `patientId` we've never seen, without a
  `fullName`. Include `fullName` if this is genuinely a new patient.
  Otherwise, check the `patientId` for typos.
- **`error` on an individual report in step 2 or 3** — that one report failed
  (often: the patient wasn't registered yet, or the file wasn't a valid
  PDF) but the rest of the batch still went through — check each item's
  `status` field.
- **`conflict` on an individual report** — that `externalId` already belongs
  to different PDF bytes. Do not overwrite it; issue a new `externalId`.
- **`413`** — the request exceeded 100MB of PDF data; split it into smaller batches.
- **`429 Rate limit exceeded`** — you're sending faster than 60 requests/min
  from one IP. Slow down and retry after the `Retry-After` header's value
  (in seconds).

For the full field-by-field reference, exact validation rules, and copy-paste
curl/Node.js examples, see **[docs/API.md](API.md)**.
