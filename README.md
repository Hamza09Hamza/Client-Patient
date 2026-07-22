# Meridian Clinic — Laboratory Results Website

A patient-facing website where clinic patients securely view, filter, print, and download
their laboratory results, plus an administration console for clinic staff and a
token-protected integration API for the clinic's internal systems.

Built with **Next.js 16 (App Router, TypeScript)**, **PostgreSQL + Prisma**,
**Tailwind CSS 4**, **Motion** (animations), and **Lucide** icons.

## Features

### Patient portal (`/portal`)
- Sign in with the clinic-issued **Patient ID + generated password**
- Overview dashboard: stat tiles, latest reports, alert banner when recent values are critical
- Full history with **search, category/status filters, date range, sorting, pagination**
- Report detail with flagged values (Normal / Low / High / Critical)
- **Print** (print-optimized stylesheet) and **Download PDF** (server-generated with pdf-lib)
- Forgot password: patient submits **email + ID document photo + explanation**; clinic staff
  review and approve/deny
- Self-service password change

### Administration console (`/admin`)
- Dashboard: clinic-wide stats, live activity feed, quick actions
- **Patients**: register (password auto-generated, shown once), edit, enable/disable,
  regenerate credentials
- **Lab results**: record reports with dynamic analyte rows, delete, search
- **Reset requests**: review the submitted ID photo and note, approve (new credentials +
  one-click email draft) or deny with a reason
- **Audit log**: every sign-in, view, download, and administrative change

### Integration API (`/api/integration/*`)
For the clinic's internal system (LIS/HIS). Requests must send the shared key in the
`x-api-key` header (constant-time compared, rate limited).

```bash
# Verify/create a patient and receive generated credentials
curl -X POST https://<host>/api/integration/patients \
  -H "Content-Type: application/json" -H "x-api-key: $KEY" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'
# -> {"patientId":"PAT-2026-0200","fullName":"Jane Doe","password":"Kt7m-Rx4q-Wn9d","created":true}
# Posting an existing patientId regenerates their password.

# Push a validated report
curl -X POST https://<host>/api/integration/results \
  -H "Content-Type: application/json" -H "x-api-key: $KEY" \
  -d '{"patientId":"PAT-2026-0200","category":"Hematology","testName":"CBC",
       "collectedAt":"2026-07-21","values":[{"analyte":"Hemoglobin","value":"14.1",
       "unit":"g/dL","refRange":"13.0 - 17.0","flag":"NORMAL"}]}'
```

## Getting started

```bash
npm install

# Database — either use a local PostgreSQL and set DATABASE_URL in .env,
# or start the bundled Docker service (listens on host port 5433):
docker compose up -d

npx prisma migrate dev   # create schema
npx prisma db seed       # demo data
npm run dev              # http://localhost:3000
```

Copy `.env` and set real values before deploying: `DATABASE_URL`, `AUTH_SECRET`
(32+ random chars), `INTEGRATION_API_KEY`.

### Demo credentials (seed data)

| Role | Username | Password |
|---|---|---|
| Patient | `PAT-2026-0001` | `Demo-Pass-2026` |
| Admin | `admin` | `ClinicAdmin!2026` |

## Security model

- Passwords hashed with **bcrypt (cost 12)**; plaintext exists only in the response that
  generates it — admins **regenerate** credentials, they can never read them
- Sessions are **HS256 JWTs in httpOnly, sameSite cookies** (8 h); the proxy does
  optimistic role checks and every page/action re-verifies against the database
- Login, reset-request, and integration endpoints are **rate limited**
- Patients can only query their own rows (`patientDbId` scoping in every query)
- Uploaded ID photos live outside `public/` and are served only to authenticated admins
- Every sensitive action is written to the **audit log**

## Project structure

```
prisma/            schema + seed
src/proxy.ts       route guard (Next 16 proxy)
src/lib/           db, session, password, rate-limit, audit, server actions
src/components/    ui/ (buttons, fields, modals…), rb/ (animated components), admin/, portal/
src/app/
  login, forgot-password        public patient pages
  portal/                       patient dashboard, results, settings
  admin/login                   staff sign-in
  admin/(console)/              dashboard, patients, results, requests, audit, settings
  admin/files/[name]            authenticated ID-photo delivery
  api/integration/              patients + results ingest endpoints
  portal/results/[id]/pdf       server-generated PDF report
```
