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
- **Patients**: register (password auto-generated), edit, enable/disable, **view current
  password**, or regenerate a new one
- **Lab results**: record reports with dynamic analyte rows, delete, search
- **Reset requests**: review the submitted ID photo and note, approve (new credentials +
  one-click email draft) or deny with a reason
- **Audit log**: every sign-in, view, download, and administrative change

### Integration API (`/api/integration/*`)
For the clinic's internal system (LIS/HIS). Requests authenticate with a Bearer token.
Full reference, request/response shapes, and error codes: **[docs/API.md](docs/API.md)**.

```bash
# Verify/create a patient and receive generated credentials
curl -X POST https://<host>/api/integration/patients \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'
# -> {"patientId":"PAT-2026-0200","fullName":"Jane Doe","password":"Kt7m-Rx4q-Wn9d","created":true}
# Posting an existing patientId regenerates their password.

# Push a validated report
curl -X POST https://<host>/api/integration/results \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
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

### Where the database actually lives (local dev)

`DATABASE_URL` in `.env` decides this — as shipped it points at a **local PostgreSQL**
server, not Docker: `postgresql://postgres@localhost:5432/clinic_portal`. On macOS
with Homebrew that's the `postgresql@15` service (`brew services list` to check),
storing data under `/opt/homebrew/var/postgresql@15`, with a `clinic_portal` database
created for this project. Inspect it directly with `psql clinic_portal` or any GUI
client (TablePlus, Postico, DBeaver) pointed at `localhost:5432`.

If you'd rather not run Postgres on the host at all, switch to the bundled
`docker-compose.yml` instead: run `docker compose up -d`, then change
`DATABASE_URL` in `.env` to `postgresql://clinic:clinic_dev_password@localhost:5433/clinic_portal`
(note the `5433` port — chosen so it doesn't collide with a host Postgres).

For a real deployment, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Environment variables

Copy `.env` and set real values before deploying: `DATABASE_URL`, `AUTH_SECRET`
(32+ random chars), `INTEGRATION_API_KEY` (16+ random chars).

### Demo credentials (seed data)

| Role | Username | Password |
|---|---|---|
| Patient | `PAT-2026-0001` | `Demo-Pass-2026` |
| Admin | `admin` | `ClinicAdmin!2026` |

## Security model

- **Passwords are stored in plaintext** — a deliberate product decision, not an
  oversight, so admins can view a patient's current password on demand (Patients →
  select patient → *View password*), not just regenerate it. This trades off
  significant security for that convenience: **anyone who reads the database reads
  every password.** Every generation, regeneration, and view is written to the audit
  log with the acting admin. If you'd rather have the standard, safer behavior
  (one-way hashing; admins can only regenerate, never view), that's a small change in
  `src/lib/password.ts` + the `password`/`password` fields in `prisma/schema.prisma` —
  ask if you want it switched. See **[DEPLOYMENT.md](DEPLOYMENT.md) → Security notes**
  for how to compensate operationally (encryption at rest, network-restricted DB
  access, encrypted backups).
- Sessions are **HS256 JWTs in httpOnly, sameSite cookies** (8 h); the proxy does
  optimistic role checks and every page/action re-verifies against the database
- The integration API authenticates with a **Bearer token**, constant-time compared —
  see [docs/API.md](docs/API.md)
- Login, reset-request, and integration endpoints are **rate limited**
- Patients can only query their own rows (`patientDbId` scoping in every query)
- Uploaded ID photos live outside `public/` and are served only to authenticated admins
- Every sensitive action is written to the **audit log**

## Project structure

```
docs/API.md         integration API reference (auth, endpoints, examples)
DEPLOYMENT.md        production deploy guide
scripts/deploy.sh    install → migrate → build → start
prisma/              schema + seed (seed refuses to run in production)
src/proxy.ts         route guard (Next 16 proxy)
src/lib/              db, session, password, rate-limit, audit, server actions
src/components/       ui/ (buttons, fields, modals…), rb/ (animated components), admin/, portal/
src/app/
  login, forgot-password        public patient pages
  portal/                       patient dashboard, results, settings
  admin/login                   staff sign-in
  admin/(console)/              dashboard, patients, results, requests, audit, settings
  admin/files/[name]            authenticated ID-photo delivery
  api/integration/              patients + results ingest endpoints (Bearer auth)
  api/health/                   liveness + DB check
  portal/results/[id]/pdf       server-generated PDF report
```
