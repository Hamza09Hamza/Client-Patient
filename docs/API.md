# Integration API

This is the contract for the clinic's internal systems (LIS/HIS, registration desk
software, etc.) to talk to the patient portal: provision patient accounts and push
laboratory reports. It is **not** used by the website itself — the patient portal and
admin console authenticate with cookie sessions, not this API.

Base URL: `https://<your-domain>` (or `http://localhost:3000` in development).

## Authentication

Every request must carry the shared secret as a **Bearer token** in the standard
`Authorization` header:

```
Authorization: Bearer <INTEGRATION_API_KEY>
```

The key is configured on the server via the `INTEGRATION_API_KEY` environment
variable (see `.env`). There is no per-client key — anyone with the key can call
both endpoints, so treat it like a database credential:

- Never put it in client-side code, mobile apps, or URLs.
- Send it only over HTTPS in production.
- Rotate it if it is ever exposed (edit `INTEGRATION_API_KEY` and redeploy — this
  immediately invalidates the old value).

### Auth failure responses

| Status | Body | Cause |
|---|---|---|
| `401` | `{"error":"Missing or malformed Authorization header. Expected: \"Bearer <api-key>\"."}` | Header absent or not in `Bearer <token>` form |
| `401` | `{"error":"Invalid API key."}` | Header present but the token doesn't match |
| `429` | `{"error":"Rate limit exceeded."}` (with a `Retry-After` header, in seconds) | More than 60 requests/minute from the same IP |
| `503` | `{"error":"Integration API is not configured on the server."}` | `INTEGRATION_API_KEY` is unset or under 16 characters on the server |

Every call — success or failure — is written to the audit log with actor `integration`.

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

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error":"Body must be valid JSON."}` | Malformed JSON |
| `404` | `{"error":"Unknown patientId — include fullName to create the patient."}` | New ID without a name |
| `422` | `{"error":"Invalid payload.","issues":[...]}` | Failed field validation |

## `POST /api/integration/results`

Pushes one validated laboratory report for an **existing** patient. The report
number (e.g. `LAB-2026-1071`) is assigned automatically and the report becomes
visible in the patient's portal immediately.

### Request

```http
POST /api/integration/results
Authorization: Bearer <INTEGRATION_API_KEY>
Content-Type: application/json

{
  "patientId": "PAT-2026-0200",
  "category": "Hematology",
  "testName": "Complete Blood Count (CBC)",
  "specimen": "Whole blood (EDTA)",
  "orderingPhysician": "Dr. S. Haddad",
  "collectedAt": "2026-07-21T09:30:00Z",
  "status": "COMPLETED",
  "notes": "Sample slightly hemolyzed; values verified by repeat analysis.",
  "values": [
    { "analyte": "Hemoglobin", "value": "14.1", "unit": "g/dL", "refRange": "13.0 - 17.0", "flag": "NORMAL" },
    { "analyte": "Platelets", "value": "120", "unit": "10^3/uL", "refRange": "150 - 400", "flag": "LOW" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | string | yes | Must already exist (create it first via the endpoint above) |
| `category` | string | yes | 2–80 chars, e.g. `Hematology`, `Biochemistry` |
| `testName` | string | yes | 2–160 chars |
| `specimen` | string | no | e.g. `Serum`, `Whole blood (EDTA)` |
| `orderingPhysician` | string | no | max 120 chars |
| `collectedAt` | string | yes | ISO 8601 datetime (`2026-07-21T09:30:00Z`) or date (`2026-07-21`) |
| `reportedAt` | string | no | ISO 8601 datetime; defaults to now when `status` isn't `PENDING` |
| `status` | `"PENDING" \| "COMPLETED" \| "REVIEWED"` | no | defaults to `COMPLETED` |
| `notes` | string | no | max 2000 chars |
| `values` | array | no* | see below. *Required (min 1) unless `status` is `PENDING` |

Each entry in `values`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `analyte` | string | yes | e.g. `Hemoglobin` |
| `value` | string | yes | kept as a string to allow `"Positive"`, `"<0.01"`, etc. |
| `unit` | string | no | e.g. `g/dL` |
| `refRange` | string | no | display form, e.g. `13.0 - 17.0` |
| `flag` | `"NORMAL" \| "LOW" \| "HIGH" \| "CRITICAL"` | no | defaults to `NORMAL` |

### Response — `201 Created`

```json
{ "reference": "LAB-2026-1071", "patientId": "PAT-2026-0200", "status": "COMPLETED" }
```

### Error responses

| Status | Body | Cause |
|---|---|---|
| `404` | `{"error":"Unknown patientId — provision the patient first via /api/integration/patients."}` | Patient doesn't exist |
| `422` | `{"error":"A completed report needs at least one value (or send status PENDING)."}` | Non-pending report with no values |
| `422` | `{"error":"Invalid payload.","issues":[...]}` | Failed field validation |

## Rate limits

60 requests/minute per source IP, shared across both endpoints. Exceeding it
returns `429` with a `Retry-After` header (seconds until the window resets). If
your integration needs a higher ceiling, raise it in `src/lib/integration-auth.ts`.

## Examples

### cURL

```bash
KEY="your-integration-api-key"

# Provision a patient
curl -X POST https://your-domain/api/integration/patients \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'

# Push a result
curl -X POST https://your-domain/api/integration/results \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "patientId":"PAT-2026-0200",
        "category":"Hematology",
        "testName":"CBC",
        "collectedAt":"2026-07-21",
        "values":[{"analyte":"Hemoglobin","value":"14.1","unit":"g/dL","refRange":"13.0 - 17.0","flag":"NORMAL"}]
      }'
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
```
