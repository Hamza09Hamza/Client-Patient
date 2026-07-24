# Integration API

This is the contract between the clinic's system (SERVER A) and the patient
portal (SERVER B). SERVER A provisions patients and pushes completed report PDFs.
SERVER B never calls into the clinic's network.

There is no staff console and no password-update operation in this application.

Base URL: `https://<your-domain>` in production.

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

SERVER A sends report metadata and the corresponding PDF bytes as
`multipart/form-data`.

Current limits:

- 1–10 reports per request
- 25 MB per PDF
- 100 MB total PDF data per request

The clinic normally sends 5–7 reports together. SERVER B processes them
sequentially inside the request and returns only after the batch is finished. A
separate queue is not required for the current volume.

### Request parts

One text part named `metadata` contains a JSON array:

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
    "notes": "Optional note"
  }
]
```

Each entry requires a corresponding file part named `file:<externalId>`. For the
example above, the part name is `file:A-88213`.

Metadata fields:

| Field | Required | Validation |
|---|---|---|
| `patientId` | yes | Must already be provisioned |
| `externalId` | yes | 1–120 characters; identifies this report within the patient |
| `title` | yes | 1–200 characters |
| `category` | no | Maximum 80 characters; defaults to `Clinic report` |
| `collectedAt` | yes | A date or datetime accepted by JavaScript's date parser |
| `physician` | no | Maximum 120 characters |
| `specimen` | no | Maximum 80 characters |
| `notes` | no | Maximum 2,000 characters |

`externalId` values must be unique within one batch. The database identity is
`(patient, externalId)`, so different patients may use the same external document
number.

Example:

```bash
curl -X POST https://your-domain/api/integration/reports \
  -H "Authorization: Bearer $KEY" \
  -F 'metadata=[{"patientId":"PAT-2026-0200","externalId":"A-88213","title":"Complete Blood Count","category":"Hematology","collectedAt":"2026-06-14"}]' \
  -F "file:A-88213=@/path/to/A-88213.pdf;type=application/pdf"
```

### Successful item

```json
{
  "externalId": "A-88213",
  "patientId": "PAT-2026-0200",
  "status": "stored",
  "qrGenerated": true,
  "qr": {
    "publicId": "RPT-7K4MX2",
    "url": "https://your-domain/r/RPT-7K4MX2#t=<opaque-secret>",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" ...>...</svg>",
    "expiresAt": "2026-08-23T10:15:00.000Z"
  }
}
```

`qr.svg` is ready to print. The URL grants access only to this report and expires
after 30 days.

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

Retrying the same patient and `externalId` updates that report and mints a new QR.

### Resending a report

On a successful resend:

1. Server B writes the replacement PDF under a new random filename.
2. The database is updated to point the report at that replacement.
3. The previous PDF is removed if no other database row references it.
4. A fresh QR grant is created.

If the database update fails, the newly written unreferenced file is removed. This
prevents invisible orphan files from accumulating.

The earlier QR grant remains valid until it expires or is manually revoked and will
display the report's current replacement PDF.

### Whole-request errors

| Status | Meaning |
|---|---|
| `400` | Invalid multipart body or missing/invalid `metadata` |
| `413` | Declared request or total PDF data exceeds 100 MB |
| `422` | Metadata validation failure, duplicate `externalId`, or more than 10 entries |

## QR single-report sharing

The QR URL has this form:

```text
https://your-domain/r/{publicId}#t={token}
```

The secret is in the URL fragment, which browsers do not send in the initial HTTP
request. Client-side code exchanges it through:

```text
POST /api/public/report-access/exchange
```

After a valid exchange, Server B sets a one-hour HttpOnly, SameSite=Strict cookie
scoped to `/r/{publicId}`. The raw QR token is never stored; the database contains
only its SHA-256 hash.

The PDF route rechecks expiry and revocation on every request. Grants expire after
30 days. There is not yet an integration endpoint for revocation; operational
revocation currently requires setting `ReportShareGrant.revokedAt` in PostgreSQL.

## Rate limits and retries

- Integration API: 60 requests/minute per source IP
- Public QR exchange: 20 attempts/minute per source IP

These are in-memory, single-instance limits. Configure the reverse proxy to replace
untrusted forwarding headers and use a shared limiter before horizontally scaling
Server B.

SERVER A should:

1. Inspect every item in the `results` array.
2. Retain successful QR output immediately; the plaintext QR token cannot be
   reconstructed later.
3. Retry only failed items using the same `patientId` and `externalId`.
4. Apply bounded exponential backoff for `429`, `503`, and network failures.
