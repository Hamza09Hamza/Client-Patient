# Integration API

This is the contract between the clinic's system (SERVER A) and the patient
portal (SERVER B). SERVER A provisions patients and pushes completed report PDFs.
SERVER B never calls into the clinic's network.

There is no staff console and no password-update operation in this application.

Base URL: `https://cliniqueamina.mobi:8443` in production.

## Authentication

Both integration endpoints require:

```http
Authorization: Bearer <INTEGRATION_API_KEY>
```

`INTEGRATION_API_KEY` is a server-side environment variable. Send it only over
HTTPS and never place it in browser code, mobile applications, URLs, or logs.

Authentication responses:

| Status | Meaning |
|---|---|
| `401` | Missing, malformed, or invalid Bearer token |
| `429` | More than 60 integration requests per minute from the same trusted source IP |
| `503` | Server B has no valid `INTEGRATION_API_KEY` configured |

Successful provisioning and report pushes are audit-logged. Authentication and
payload-validation failures are not currently persisted to the application audit
table; reverse-proxy access logs may still record the request status.

## Patient provisioning — `POST /api/integration/patients`

This endpoint is create-once and idempotent by `patientId`.

### New patient

For an unknown `patientId`, `fullName` is required. Server B generates the
patient's portal username and password, stores only the scrypt password hash, and
returns the plaintext password in this response exactly once.

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

Fields:

| Field | Required | Validation |
|---|---|---|
| `patientId` | yes | 3–60 letters, numbers, or dashes; SERVER A's patient identifier |
| `fullName` | for a new patient | 2–120 characters |
| `email` | no | Valid email, maximum 200 characters |
| `phone` | no | Maximum 40 characters |
| `dateOfBirth` | no | `YYYY-MM-DD` |
| `gender` | no | Maximum 20 characters |

Response: `201 Created`

```json
{
  "patientId": "PAT-2026-0200",
  "username": "k7mXq2wR",
  "fullName": "Jane Doe",
  "password": "b8WD2Zmy",
  "created": true
}
```

SERVER A must retain and distribute the returned credentials. Server B cannot
recover or return the plaintext password later.

### Existing patient

Repeating the request for an existing `patientId` does not update demographics,
generate a password, replace the password hash, or return a password.

Response: `200 OK`

```json
{
  "patientId": "PAT-2026-0200",
  "username": "k7mXq2wR",
  "fullName": "Jane Doe",
  "created": false
}
```

This makes retries safe: if SERVER A is uncertain whether the original request
succeeded, it can repeat the call without changing the patient's login.

Patient demographic updates, password rotation, account disabling, and deletion
are outside the current API contract.

Other responses:

| Status | Meaning |
|---|---|
| `400` | Body is not valid JSON |
| `404` | Unknown `patientId` without the `fullName` needed to create it |
| `422` | One or more fields failed validation |

## Report delivery — `POST /api/integration/reports`

This is a two-phase, always-multipart/form-data endpoint. The `file:<externalId>`
part is **optional**:

- **Omitted** — pre-registers the report slot (typically at patient intake, e.g.
  when an appointment/accession number like `LAB-26070424` is created, before any
  PDF exists) and mints its QR code. Until a PDF arrives, the QR's page tells the
  patient their results aren't ready yet.
- **Present** — attaches the PDF. If the slot was already pre-registered (same
  `patientId` + `externalId`), it completes that slot and hands back the **same**
  QR minted in phase 1. If no slot existed yet, it creates and completes one in a
  single call — useful for reports that don't need a separate intake step.

This lets the clinic print a patient's QR code (see the sample card below) at
intake — before any result exists — and have it start working automatically the
moment the PDF is pushed later, with no reprint.

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

Current limits:

- 1–10 reports per request
- 25 MB per PDF
- 100 MB total PDF data per request
- 105 MB for the complete multipart request, including metadata and headers

The clinic normally sends 5–7 reports together. SERVER B processes them
sequentially inside the request and returns only after the batch is finished. A
separate queue is not required for the current volume.

A completed report's PDF is immutable. `(patientId, externalId)` identifies one
exact PDF, not a mutable slot for the patient's latest document — see
"Identical retries and external-ID conflicts" below.

### Request parts

One text part named `metadata` contains a JSON array:

```json
[
  {
    "patientId": "PAT-2026-0200",
    "externalId": "LAB-26070424",
    "title": "Complete Blood Count",
    "category": "Hematology",
    "collectedAt": "2026-06-14",
    "physician": "Dr. S. Haddad",
    "specimen": "Whole blood (EDTA)",
    "notes": "Optional note"
  }
]
```

When a file is attached for an entry, its part is named `file:<externalId>` — for
the example above, `file:LAB-26070424`. Omit that part entirely to pre-register
the slot instead.

Metadata fields:

| Field | Required | Validation |
|---|---|---|
| `patientId` | yes | Must already be provisioned |
| `externalId` | yes | 1–120 characters; identifies this report within the patient (e.g. the appointment/accession number) |
| `title` | no | 1–200 characters. Falls back to `"Pending report"` if never supplied. A value sent alongside the PDF (or in a later call) updates it |
| `category` | no | Maximum 80 characters; defaults to `Clinic report` |
| `collectedAt` | yes | A date or datetime accepted by JavaScript's date parser. Only applied when the slot is first created; later calls for the same `externalId` don't change it |
| `physician` | no | Maximum 120 characters |
| `specimen` | no | Maximum 80 characters |
| `notes` | no | Maximum 2,000 characters |

`externalId` values must be unique within one batch. The database identity is
`(patient, externalId)`, so different patients may use the same external document
number.

Phase 1 — pre-register at intake, no file part:

```bash
curl -X POST https://cliniqueamina.mobi:8443/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"LAB-26070424","collectedAt":"2026-07-26"}]'
```

Phase 2 — attach the PDF once it's ready (same `patientId` + `externalId`):

```bash
curl -X POST https://cliniqueamina.mobi:8443/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"LAB-26070424","title":"Complete Blood Count","category":"Hematology","collectedAt":"2026-07-26"}]' \
  -F "file:LAB-26070424=@/path/to/LAB-26070424.pdf;type=application/pdf"
```

A single call that both creates and completes a report in one step (no separate
intake step) uses the same request shape as phase 2 — it works identically
whether or not a phase-1 call happened first.

### Response `status` values

| `status` | Meaning | `qr` present |
|---|---|---|
| `pending_created` | New slot pre-registered (no PDF yet); this is the QR to print | yes |
| `pending_exists` | Slot was already pre-registered; same QR returned again (idempotent retry) | yes |
| `stored` | PDF attached/stored just now — the slot may have been pre-registered earlier or created fresh in this call | yes |
| `already_stored` | PDF already stored previously with matching bytes; same QR returned again | yes |
| `conflict` | Same `patientId` + `externalId` already has a *different* PDF stored | no |
| `error` | See `error` for the reason; nothing changed for this item | no |

### Successful item

```json
{
  "externalId": "LAB-26070424",
  "patientId": "PAT-2026-0200",
  "status": "stored",
  "qrGenerated": true,
  "qr": {
    "publicId": "RPT-7K4MX2",
    "url": "https://cliniqueamina.mobi:8443/r/RPT-7K4MX2#t=<opaque-secret>",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
    "expiresAt": "2026-08-23T10:15:00.000Z"
  }
}
```

`qr.svg` is ready to print. The URL grants access only to this report and expires
30 days after it was first minted — attaching a PDF to a pre-registered slot
extends that back out to a full 30 days from the attach moment, so a QR that's
been sitting on a printed card doesn't expire right as the result finally arrives.

A pre-registration call (`pending_created`) returns this same shape; scanning
that QR before the PDF exists shows a "results aren't ready yet" page instead of
the report.

### Failed item

```json
{
  "externalId": "A-88214",
  "patientId": "PAT-2026-0311",
  "status": "error",
  "qrGenerated": false,
  "error": "Unknown patientId — provision the patient via /api/integration/patients first."
}
```

Normal item errors—unknown patient, missing file, oversized PDF, invalid date, or
invalid PDF header—do not stop the remaining items.

Unexpected storage/database failures also become per-item errors:

```json
{
  "externalId": "A-88215",
  "patientId": "PAT-2026-0200",
  "status": "error",
  "qrGenerated": false,
  "error": "Report could not be stored. Retry this externalId."
}
```

If the database update succeeds but QR creation fails, Server B keeps the report
available in the logged-in portal and returns:

```json
{
  "externalId": "A-88215",
  "patientId": "PAT-2026-0200",
  "status": "error",
  "qrGenerated": false,
  "error": "Report stored, but QR generation failed. Retry this externalId."
}
```

Retrying the same patient, `externalId`, and identical PDF returns the same QR
that was already issued for this report — see "Idempotency and QR reuse" below —
without modifying the stored report.

### Idempotency and QR reuse

Every response for a given `(patientId, externalId)` — the pre-registration
call, any retry of it, the PDF attach, and any retry of *that* — carries the
**same** `qr.publicId` and `qr.url`. Server B never mints a second, different QR
for a report that already has one active; see `getOrMintShareGrant` in
`src/lib/report-share.ts`. This is what makes it safe to print the QR at intake:
whatever URL was printed on the card keeps working after the PDF attaches later,
with no reprint and no need to reconcile two different codes.

The plaintext QR token only ever leaves Server B inside a `qr.url`/`qr.svg` in an
API response — never logged, and stored at rest only as a one-way hash (for
verifying scans) plus a separately-keyed encrypted copy (solely so it can be
handed back in a later response for the same report). SERVER A should still
retain whichever response it receives rather than assume a later call will
return it identically shaped — the `status` differs by call (`pending_created`
vs. `stored`, for example) even when the QR itself doesn't.

### Identical retries and external-ID conflicts

Server B stores a SHA-256 fingerprint with every integrated PDF.

- If the same patient, `externalId`, and identical PDF bytes arrive again, Server B
  does not write another file or change the report metadata. It returns
  `status: "already_stored"` and the same QR as before, so a lost HTTP response
  can be recovered safely.
- If the same patient and `externalId` arrive with different PDF bytes, Server B
  returns `status: "conflict"`, `qrGenerated: false`, and leaves the original
  report untouched. A corrected or newly issued document must use a new
  `externalId`.

Identical retry:

```json
{
  "externalId": "A-88213",
  "patientId": "PAT-2026-0200",
  "status": "already_stored",
  "qrGenerated": true,
  "qr": {
    "publicId": "RPT-7K4MX2",
    "url": "https://cliniqueamina.mobi:8443/r/RPT-7K4MX2#t=<same-opaque-secret>",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
    "expiresAt": "2026-08-23T10:15:00.000Z"
  }
}
```

Conflicting content:

```json
{
  "externalId": "A-88213",
  "patientId": "PAT-2026-0200",
  "status": "conflict",
  "qrGenerated": false,
  "error": "This externalId already belongs to a different PDF. Send the new report with a new externalId."
}
```

If a new PDF is written but its database insert fails, Server B removes that
unreferenced file.

### Whole-request errors

| Status | Meaning |
|---|---|
| `400` | Invalid multipart body or missing/invalid `metadata` |
| `413` | Complete multipart request exceeds 105 MB, or combined PDF data exceeds 100 MB |
| `422` | Metadata validation failure, duplicate `externalId`, or more than 10 entries |

## QR single-report sharing

The QR URL has this form:

```text
https://cliniqueamina.mobi:8443/r/{publicId}#t={token}
```

The secret is in the URL fragment, which browsers do not send in the initial HTTP
request. Client-side code exchanges it through:

```text
POST /api/public/report-access/exchange
```

After a valid exchange, Server B sets a one-hour HttpOnly, SameSite=Strict cookie
scoped to `/r/{publicId}`. Scan verification never touches plaintext — it hashes
the incoming token and compares against the stored SHA-256 hash, same as password
verification. Separately, and only for the report-delivery reuse behavior
described above, an AES-256-GCM copy of the token is also kept (keyed by
`REPORT_SHARE_ENCRYPTION_KEY`) so the *same* grant can be handed back in a later
`/api/integration/reports` response; nothing about scanning or redeeming the QR
depends on that copy existing.

The PDF route rechecks expiry and revocation on every request. Grants expire 30
days after they were minted, or after they were last extended by a PDF attaching
to a pre-registered slot (see "Response `status` values" above). There is not yet
an integration endpoint for revocation; operational revocation currently requires
setting `ReportShareGrant.revokedAt` in PostgreSQL.

While a report is pre-registered but has no PDF yet, its `/r/{publicId}` page
shows a "results aren't ready yet" notice rather than "not found" — the grant is
valid, the report just hasn't arrived.

## Rate limits and retries

- Integration API: 60 requests/minute per source IP
- Public QR exchange: 20 attempts/minute per source IP

These are in-memory, single-instance limits. Configure the reverse proxy to replace
untrusted forwarding headers and use a shared limiter before horizontally scaling
Server B.

SERVER A should:

1. Inspect every item in the `results` array.
2. Treat `pending_created`, `pending_exists`, `stored`, and `already_stored` all
   as success and retain their QR output — it's the same QR every time for a
   given `(patientId, externalId)`, so it's safe (if inconvenient) to re-fetch
   it with a follow-up call, but there's no need to; save it from whichever
   response first returns it.
3. Retry `error` items using the same `patientId` and `externalId`.
4. For `conflict`, preserve the original and assign the new document a new
   `externalId`; repeatedly retrying the conflicting ID cannot succeed.
5. Apply bounded exponential backoff for `429`, `503`, and network failures.
