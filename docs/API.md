# Integration API

This is the contract for the clinic's internal systems (LIS/HIS, registration desk
software, etc.) to talk to the patient portal: provision patient accounts and
credentials, then push report PDFs. It is **not** used by the website itself — the
patient portal and admin console authenticate with cookie sessions, not this API.

All three endpoints are **push-only from the clinic's side** — this app never calls
out to the clinic's network. That matters if this app's VM has no outbound path into
the clinic's internal systems (a common lockdown): as long as the clinic's system
can make an outbound HTTPS call to this app, provisioning and report delivery both
work regardless of what this app's VM is allowed to reach.

Four separate secrets are in play, each scoped to a different actor — don't reuse one
where another belongs:

| Secret | Purpose | Holder |
|---|---|---|
| `INTEGRATION_API_KEY` | Provision/re-credential patients; push current reports (mints a QR per report) | The clinic's system |
| `INTEGRATION_SYNC_API_KEY` | Import historical reports in bulk — never mints a QR | A migration/sync job, possibly a different credential than day-to-day pushes |
| QR share token | View exactly one report, no login | Whoever holds the QR (the patient, printed on their report) |
| Patient password | View that patient's full report history | The patient |

Base URL: `https://<your-domain>` (or `http://localhost:3000` in development).

## Authentication

Every request to an `/api/integration/*` endpoint must carry the relevant shared
secret as a **Bearer token** in the standard `Authorization` header:

```
Authorization: Bearer <INTEGRATION_API_KEY>
```

`POST /api/integration/patients` and `POST /api/integration/reports` check
`INTEGRATION_API_KEY`; `POST /api/integration/sync/reports` checks the separate
`INTEGRATION_SYNC_API_KEY` (see [historical sync](#historical-sync--post-apiintegrationsyncreports)
below for why it's a different key). Both are configured via environment variables
(see `.env`). There is no per-client key — anyone with a key can call the endpoints
it guards, so treat each like a database credential:

- Never put them in client-side code, mobile apps, or URLs.
- Send them only over HTTPS in production.
- Rotate one if it is ever exposed (edit the env var and redeploy — this immediately
  invalidates the old value). Rotating `INTEGRATION_SYNC_API_KEY` doesn't affect
  day-to-day report delivery, and vice versa.

### Auth failure responses

| Status | Body | Cause |
|---|---|---|
| `401` | `{"error":"Missing or malformed Authorization header. Expected: \"Bearer <api-key>\"."}` | Header absent or not in `Bearer <token>` form |
| `401` | `{"error":"Invalid API key."}` | Header present but the token doesn't match |
| `429` | `{"error":"Rate limit exceeded."}` (with a `Retry-After` header, in seconds) | More than 60 requests/minute from the same IP, for that key's endpoint(s) |
| `503` | `{"error":"Integration API is not configured on the server."}` | The relevant key env var is unset or under 16 characters on the server |

Every call — success or failure — is written to the audit log with actor
`integration` (main key) or `integration-sync` (sync key).

## `POST /api/integration/patients`

Verifies or provisions a patient by clinic ID and returns freshly generated
credentials. This is also how you **re-credential** an existing patient (e.g. they
lost their password and called the clinic) — call it again with just the `patientId`.

**Behavior:**
- Unknown `patientId` + `fullName` provided → creates the patient, returns `201`.
- Unknown `patientId`, no `fullName` → `404` (can't create without a name).
- Known `patientId` → generates and stores a new password, invalidating the old one; `fullName` and other fields are ignored. Returns `200`.

### Request

```http
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

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | string | yes | 3–60 chars, letters/numbers/dashes only. This becomes the patient's login username. |
| `fullName` | string | only when creating | 2–120 chars |
| `email` | string | no | valid email, max 200 chars |
| `phone` | string | no | max 40 chars |
| `dateOfBirth` | string | no | `YYYY-MM-DD` |
| `gender` | string | no | free text, max 20 chars |

### Response — `201 Created` (new patient)

```json
{
  "patientId": "PAT-2026-0200",
  "fullName": "Jane Doe",
  "password": "Kt7m-Rx4q-Wn9d",
  "created": true
}
```

### Response — `200 OK` (existing patient, re-credentialed)

```json
{
  "patientId": "PAT-2026-0200",
  "fullName": "Jane Doe",
  "password": "vwQ4-4tKu-4zAv",
  "created": false
}
```

**The `password` field is the only place this value is returned — capture it
immediately.** It is also retrievable later by an admin from the console (Patients →
select patient → *View password*), since this system stores credentials in
plaintext by design — see the Security note in the main [README](../README.md).

Once a patient is provisioned, push their reports via [`POST
/api/integration/reports`](#current-report-delivery--post-apiintegrationreports) below.

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":"Body must be valid JSON."}` | Malformed JSON |
| `404` | `{"error":"Unknown patientId — include fullName to create the patient."}` | New ID without a name |
| `422` | `{"error":"Invalid payload.","issues":[...]}` | Failed field validation |

---

## Current report delivery — `POST /api/integration/reports`

The clinic's system sends the actual PDF bytes here — this app stores them locally
(under `uploads/reports/`, outside the public web root), serves them to the patient
through its own PDF viewer, **and mints a QR share grant for each stored report** so
it can be handed to the patient (e.g. printed on the paper report) as a scan-to-view
link that needs no login — see [QR single-report sharing](#qr-single-report-sharing)
below. There is no pull side to this contract: this app never fetches or reaches out
for a report, it only receives what's pushed to it. That also means the **patient
must already be provisioned** (via `POST /api/integration/patients`) before a report
for them is accepted — this endpoint does not create patients.

Use this endpoint for reports as they're freshly generated at the clinic (e.g. every
10–15 reports, or on whatever cadence suits the clinic's system). For importing a
large batch of **historical** reports — where a fresh QR code serves no purpose —
use [`POST /api/integration/sync/reports`](#historical-sync--post-apiintegrationsyncreports)
instead; it's the same request/response shape, just without QR generation.

### Request

`multipart/form-data`, authenticated the same way as `/api/integration/patients`
(`Authorization: Bearer <INTEGRATION_API_KEY>`). Two kinds of parts:

- **`metadata`** — one JSON array, one entry per report in the batch (1–60 entries;
  chunk a larger backfill into multiple calls).
- **One file part per report**, named `file:<externalId>` — the external id ties
  each PDF to its metadata entry, so parts can arrive in any order.

```http
POST /api/integration/reports
Authorization: Bearer <INTEGRATION_API_KEY>
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="metadata"

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
--boundary
Content-Disposition: form-data; name="file:A-88213"; filename="A-88213.pdf"
Content-Type: application/pdf

<PDF bytes>
--boundary--
```

| Field | Required | Notes |
|---|---|---|
| `patientId` | yes | Must already exist (created via `/api/integration/patients`). |
| `externalId` | yes | The clinic system's own id for this document. Reports are upserted on `(patient, externalId)`, so resending the same one (e.g. after a retry) safely overwrites rather than duplicates. Also used to match the `file:<externalId>` part. |
| `title` | yes | Shown as the report name in the portal. |
| `category` | no | Defaults to "Clinic report" if omitted. |
| `collectedAt` | yes | ISO date or datetime. |
| `physician` | no | |
| `specimen` | no | |
| `notes` | no | |

Each PDF must be under 25MB and start with a valid `%PDF-` header — anything else is
rejected for that item without failing the rest of the batch.

### Response — `200 OK`

Always `200` if the request itself was well-formed — failures are reported per item,
since one bad report in a batch shouldn't sink the rest. Every stored item includes
its QR grant **and the patient's current login credentials** — print both on the
physical report. There is no online "forgot password" flow in this app; a patient's
recovery path is simply having any older report on paper, since each one carries a
valid username/password at the time it was printed:

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
      },
      "credentials": { "username": "PAT-2026-0200", "password": "Kt7m-Rx4q-Wn9d" }
    },
    {
      "externalId": "A-88214",
      "patientId": "PAT-2026-0311",
      "status": "error",
      "qrGenerated": true,
      "error": "Unknown patientId — provision the patient via /api/integration/patients first."
    }
  ]
}
```

`credentials.password` is the patient's **current** password, unchanged by this call —
pushing a report never regenerates it. This is the same plaintext value an admin can
view from the console (Patients → select patient → *View password*); see the README
"Security model" section for that tradeoff. If the patient's password was already
regenerated since their last report, older printed papers show a stale password — an
admin can always look up (or regenerate) the current one from the console.

`qr.svg` is a ready-to-print SVG QR code encoding `qr.url` — there's no separate
endpoint to fetch it again later, because the plaintext token inside the URL is
**never stored** (only its hash is, for verifying redemptions — see
[QR single-report sharing](#qr-single-report-sharing)). If the QR image is lost,
push the report again (upsert is safe, see `externalId` above) to mint a fresh one;
the old grant, if not yet expired or revoked, remains separately valid.

### Error responses (whole batch)

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":"Body must be multipart/form-data."}` | Wrong content type / unparsable body |
| `400` | `{"error":"Missing \"metadata\" field (JSON array)."}` | No `metadata` part |
| `422` | `{"error":"Invalid metadata ...","issues":[...]}` | Metadata failed validation, or more than 60 items |

---

## Historical sync — `POST /api/integration/sync/reports`

Identical request and response shape to [current report delivery](#current-report-delivery--post-apiintegrationreports)
above — same `metadata` array + `file:<externalId>` parts, same 60-item batch limit,
same per-item error reporting — with two differences:

- Authenticated with **`INTEGRATION_SYNC_API_KEY`** instead of `INTEGRATION_API_KEY`,
  so a sync job's credential can't be used to mint QR-bearing "current" deliveries
  (and vice versa — the main key doesn't work here).
- Never mints a QR share grant and never returns patient credentials. Every result
  item has `"qrGenerated": false` and no `qr` or `credentials` field.

Use this for an initial backfill of every report already on file at the clinic —
chunked across multiple calls, 60 reports at a time. Ongoing day-to-day deliveries
should go through `/api/integration/reports` instead, so each report gets its QR.

```json
{ "externalId": "LAB-2025-38114", "patientId": "PAT-2026-0044", "status": "stored", "qrGenerated": false }
```

---

## QR single-report sharing

Each report pushed through the (non-sync) delivery endpoint gets a **scoped,
revocable, single-report** access grant, returned as `qr.url` /  `qr.svg` in that
push's response. This is a separate access mechanism from both integration keys and
patient logins — never mix them:

- A QR grant authorizes viewing **one report's PDF**, nothing else — no patient
  history, no other reports, no portal navigation.
- It needs no patient login. Anyone holding the QR code (or the URL it encodes) has
  the same access — treat it as a physical bearer credential, same as a printed
  paper copy of the report itself. Anyone who photographs or forwards it can view
  the report until the grant expires or is revoked.
- It expires automatically **30 days** after being minted, and can be scanned
  multiple times within that window (practical for a paper report that might be
  revisited later, e.g. by a family member helping the patient).

### How a scan resolves

1. The QR encodes `https://your-domain/r/{publicId}#t={token}`. The part after `#`
   is a URL fragment — browsers never send it to the server on page load, so it
   can't leak into server logs, analytics, or the `Referer` header the way a query
   string could.
2. `GET /r/{publicId}` renders a minimal page (no login, no navigation to `/portal`)
   with client-side JS that reads the fragment and `POST`s it to
   `/api/public/report-access/exchange` with `{ "publicId", "token" }`.
3. On success, that endpoint sets an `HttpOnly`, `Secure` (production),
   `SameSite=Strict` cookie (`report_share_session`) **scoped to `/r/{publicId}`
   only** — it can't be replayed against any other report's share page — and the
   client strips the token from the visible URL (`history.replaceState`) before
   reloading.
4. `GET /r/{publicId}/file` serves the PDF, re-checking the grant against the
   database (not just the cookie) on every request — so revoking a grant takes
   effect immediately instead of waiting out the session's remaining lifetime.

### Revocation and expiry

There's no API endpoint for this yet — revoke a grant directly in the database
(`UPDATE "ReportShareGrant" SET "revokedAt" = now() WHERE "publicId" = '...'`) if a
QR is compromised or handed out in error. A revoked or expired grant's page shows a
plain "this link is no longer valid" notice; its `/file` route returns `404`/`401`.

## Rate limits

60 requests/minute per source IP for each of `INTEGRATION_API_KEY` and
`INTEGRATION_SYNC_API_KEY` (tracked separately, so heavy sync traffic can't starve
day-to-day delivery calls or vice versa). The public
`/api/public/report-access/exchange` endpoint has its own, tighter limit — 20
attempts/minute per IP, since it's unauthenticated and a plausible target for token
guessing. Exceeding any of these returns `429` with a `Retry-After` header (seconds
until the window resets). Raise a ceiling in `src/lib/integration-auth.ts` or
`src/app/api/public/report-access/exchange/route.ts` if needed.

## Examples

### cURL

```bash
KEY="your-integration-api-key"

# Provision a patient
curl -X POST https://your-domain/api/integration/patients \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'

# Push a report PDF for that patient (mints a QR)
curl -X POST https://your-domain/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"A-88213","title":"Complete Blood Count","category":"Hematology","collectedAt":"2026-06-14"}]' \
  -F "file:A-88213=@/path/to/A-88213.pdf;type=application/pdf"

# Bulk-import historical reports (separate key, no QR)
curl -X POST https://your-domain/api/integration/sync/reports \
  -H "Authorization: Bearer $SYNC_KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0044","externalId":"LAB-2025-38114","title":"Lipid Profile","collectedAt":"2025-11-02"}]' \
  -F "file:LAB-2025-38114=@/path/to/LAB-2025-38114.pdf;type=application/pdf"
```

### Node.js

```js
const KEY = process.env.INTEGRATION_API_KEY;
const BASE = "https://your-domain";

async function provisionPatient(patient) {
  const res = await fetch(`${BASE}/api/integration/patients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patient),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json(); // { patientId, fullName, password, created }
}

async function pushReports(items) {
  // items: [{ meta: {patientId, externalId, title, collectedAt, ...}, pdf: Buffer }]
  const form = new FormData();
  form.append("metadata", JSON.stringify(items.map((i) => i.meta)));
  for (const { meta, pdf } of items) {
    form.append(`file:${meta.externalId}`, new Blob([pdf], { type: "application/pdf" }), `${meta.externalId}.pdf`);
  }
  const res = await fetch(`${BASE}/api/integration/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json(); // { results: [{ externalId, patientId, status, qrGenerated, qr?, error? }] }
}
```
