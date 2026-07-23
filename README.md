# Clinique Amina — Laboratory Results Website

A patient-facing website where clinic patients securely view, filter, and download
their laboratory results — as PDFs synced from the clinic's own system — plus an
administration console for clinic staff and a token-protected integration API for the
clinic's internal systems. Bilingual (French/English).

Built with **Next.js 16 (App Router, TypeScript)**, **PostgreSQL + Prisma**,
**Tailwind CSS 4**, **Motion** (animations), and **Lucide** icons.

The clinic name is centralized in `src/lib/config.ts` (`CLINIC_NAME`) — change it once and
every page, the generated PDF, and password-reset emails update.

## Features

### Patient portal (`/portal`)
- Sign in with the clinic-issued **Patient ID + generated password**
- **Bilingual UI** — French/English switcher (top-right on every page), cookie-persisted
- Overview dashboard: stat tiles, latest reports
- Full history with **search, category/status filters, date range, sorting, pagination**
- Report detail: a **custom-built PDF viewer** (page nav, zoom, thumbnails, fullscreen — not
  the browser's native plugin) for reports synced from the clinic's own system, wrapped in a
  hand-rolled "liquid glass" toolbar (see "Design notes" below). No structured values are
  entered or shown anywhere in the app — every report is the clinic's own PDF
- Forgot password: patient submits **email + ID document photo + explanation**; clinic staff
  review and approve/deny — **can be disabled entirely** via `PASSWORD_RESET_REQUESTS_ENABLED`,
  in which case patients are told to call the clinic directly (see "Security model" below).
  Patients never set their own password directly — there is no self-service change

### Administration console (`/admin`)
- Dashboard: clinic-wide stats, live activity feed, quick actions, and a **Stats** section
  (total/unique report downloads, patients active in the last 15 minutes, a 30-day daily-active
  trend with a sparkline)
- **Patients**: register (password auto-generated), edit, enable/disable, **view current
  password**, regenerate a new one, or manually re-sync their clinic documents. Shows each
  patient's **last sign-in device** (OS/browser, e.g. "Windows · Chrome" or "iOS · Safari")
- **Lab results**: browse and delete synced reports, search — reports can only ever be
  created by syncing from the clinic system, never entered by hand
- **Reset requests**: review the submitted ID photo and note, approve (new credentials +
  one-click email draft) or deny with a reason
- **Audit log**: every sign-in, view, download, and administrative change

### Clinic document sync (SERVER A ↔ SERVER B)
This app ("SERVER B") can pull a patient's full report history — as PDFs, not structured
values — from the clinic's own internal system ("SERVER A"). When a patient is provisioned
via the integration API (or an admin clicks **Sync from clinic system**), this app mints a
short-lived signed token and calls out to SERVER A with the patient's ID; SERVER A responds
with an array of `{ externalId, title, collectedAt, link, ... }` document records, which are
cached locally (upserted by `externalId`, so re-syncing is always safe) and shown in the
patient's results list like any other report. See **[docs/API.md → Clinic source
contract](docs/API.md#clinic-source-contract-server-a)** for the exact shape SERVER A must
implement, and the note there about `link` values that are local file paths rather than URLs.

### Integration API (`/api/integration/patients`)
For the clinic's internal system (LIS/HIS) to provision patient accounts. Requests
authenticate with a Bearer token. Full reference, request/response shape, and error
codes: **[docs/API.md](docs/API.md)**.

```bash
# Verify/create a patient and receive generated credentials
curl -X POST https://<host>/api/integration/patients \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'
# -> {"patientId":"PAT-2026-0200","fullName":"Jane Doe","password":"Kt7m-Rx4q-Wn9d","created":true}
# Posting an existing patientId regenerates their password.
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
(32+ random chars), `INTEGRATION_API_KEY` (16+ random chars). Optional, only needed for
clinic document sync: `CLINIC_SOURCE_BASE_URL`, `CLINIC_SOURCE_SHARED_SECRET` (32+ random
chars) — see [docs/API.md](docs/API.md). `PASSWORD_RESET_REQUESTS_ENABLED` toggles the
online password-reset form on/off (defaults to on) — see "Security model" below.

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
  `src/lib/password.ts` + the `password` field in `prisma/schema.prisma` — ask if you
  want it switched. See **[DEPLOYMENT.md](DEPLOYMENT.md) → Security notes**
  for how to compensate operationally (encryption at rest, network-restricted DB
  access, encrypted backups).
- **Patients cannot change their own password directly** — only request a reset
  (email + ID photo + note, reviewed by staff). That request flow itself can be turned
  off with `PASSWORD_RESET_REQUESTS_ENABLED=false`, in which case the portal tells
  patients to call the clinic directly (`CLINIC_PHONE` in `src/lib/config.ts` — replace
  the placeholder with the real number) and the server action refuses the request even
  if someone posts to it directly.
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
docs/API.md          integration API reference (auth, endpoints, clinic source contract)
DEPLOYMENT.md        production deploy guide
scripts/deploy.sh    install → migrate → build → start
scripts/copy-pdf-worker.mjs  syncs the pdf.js worker into public/pdfjs/ (runs on postinstall)
prisma/              schema + seed (seed refuses to run in production)
src/proxy.ts         route guard (Next 16 proxy)
src/lib/              db, session, password, device, rate-limit, audit, feature-flags,
                       pdf-link, i18n/, clinic-source.ts, document-sync.ts, server actions
src/components/       ui/ (buttons, fields, modals…), rb/ (animated components incl.
                       liquid-glass.tsx), portal/pdf-viewer.tsx, i18n/, admin/, portal/
src/app/
  login, forgot-password        public patient pages (reset form or "call the clinic",
                                 depending on PASSWORD_RESET_REQUESTS_ENABLED)
  portal/                       patient dashboard, results, settings
  portal/results/[id]/download  audit-logs a download, then redirects to the source PDF
  admin/login                   staff sign-in
  admin/(console)/              dashboard (incl. Stats), patients, results, requests, audit, settings
  admin/files/[name]            authenticated ID-photo delivery
  api/integration/patients      patient provisioning endpoint (Bearer auth)
  api/health/                   liveness + DB check
```
