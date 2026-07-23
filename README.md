# Clinique Amina — Laboratory Results Website

A patient-facing website where clinic patients securely view, filter, and download
their laboratory results — as PDFs pushed from the clinic's own system — plus a
token-protected integration API for the clinic's internal systems. There is no staff
web console: every patient and report is provisioned entirely through that API, from
the clinic's own internal system. Bilingual (French/English).

Built with **Next.js 16 (App Router, TypeScript)**, **PostgreSQL + Prisma**,
**Tailwind CSS 4**, **Motion** (animations), and **Lucide** icons.

The clinic name is centralized in `src/lib/config.ts` (`CLINIC_NAME`) — change it once and
every page and the generated PDF update.

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
- **No online password reset.** Patients never set their own password, and there's no
  in-app recovery flow — every physical report the clinic hands out is printed with a QR
  code (see "QR single-report sharing" below). Recovery is the clinic's own
  responsibility: `POST /api/integration/patients` re-credentials a patient and hands
  the new password back to the clinic's system, which already has it from when the
  account was first provisioned

### Clinic report push (`/api/integration/reports`, `/api/integration/sync/reports`)
Reports arrive as PDFs pushed **from** the clinic's own internal system (LIS/HIS) —
this app never calls out to fetch them. Each call sends a batch (up to 60) of
`{ patientId, externalId, title, collectedAt, ... }` metadata entries alongside their
PDF bytes as multipart file parts; this app stores each file locally under
`uploads/reports/` (upserted by `externalId`, so resending is always safe) and shows
it in the patient's results list through the built-in PDF viewer. This direction
works even when this app's VM has no outbound path into the clinic's network.
Day-to-day deliveries also mint a **QR share grant** per report — a scoped,
revocable link that shows just that one PDF with no patient login (see "QR
single-report sharing" below); a separate endpoint imports historical backfills
without generating QR codes. See **[docs/API.md → Current report
delivery](docs/API.md#current-report-delivery--post-apiintegrationreports)** for
the full request/response shape.

### QR single-report sharing (`/r/[publicId]`)
Every report delivered (not synced) gets a scan-to-view link — no patient login,
scoped to that one report only, expiring after 30 days, revocable, re-scannable
within that window. The token travels in the URL fragment (never sent to the
server on page load) and is exchanged client-side for a short-lived, path-scoped
session cookie. The same delivery call also returns the patient's current
username/password, meant to be printed alongside the QR on the physical report —
see "No online password reset" above. Full flow and security notes:
**[docs/API.md → QR single-report sharing](docs/API.md#qr-single-report-sharing)**.

### Integration API (`/api/integration/patients`, `/api/integration/reports`, `/api/integration/sync/reports`)
For the clinic's internal system (LIS/HIS) to provision patient accounts and then push
their reports. Requests authenticate with a Bearer token — day-to-day delivery and
historical sync use **separate keys** so one credential can't do the other's job.
Full reference, request/response shape, and error codes: **[docs/API.md](docs/API.md)**.

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
(32+ random chars, also signs QR share sessions), `INTEGRATION_API_KEY` (16+ random
chars — authenticates `/api/integration/patients` and `/api/integration/reports`),
and `INTEGRATION_SYNC_API_KEY` (16+ random chars, separate from the above —
authenticates only `/api/integration/sync/reports`); see [docs/API.md](docs/API.md).
`PUBLIC_BASE_URL` sets the origin baked into generated QR URLs (falls back to the
request's own origin if unset — set this explicitly behind a reverse proxy/NAT).

### Demo credentials (seed data)

| Role | Username | Password |
|---|---|---|
| Patient | `PAT-2026-0001` | `Demo-Pass-2026` |
| Admin | `admin` | `ClinicAdmin!2026` |

## Security model

- **Passwords are stored in plaintext** — a deliberate product decision, not an
  oversight, so admins can view a patient's current password on demand (Patients →
  select patient → *View password*), and so it can be printed on physical reports
  (see "No online password reset" above and `credentials` in the [report delivery
  response](docs/API.md#current-report-delivery--post-apiintegrationreports)). This
  trades off significant security for that convenience: **anyone who reads the
  database, or a printed report, reads a password.** Every generation, regeneration,
  view, and delivery-triggered inclusion is written to the audit log. If you'd rather
  have the standard, safer behavior (one-way hashing; admins can only regenerate,
  never view; drop `credentials` from the delivery response), that's a change in
  `src/lib/password.ts` + `prisma/schema.prisma` + `src/lib/report-push.ts` — ask if
  you want it switched. See **[DEPLOYMENT.md](DEPLOYMENT.md) → Security notes** for
  how to compensate operationally (encryption at rest, network-restricted DB access,
  encrypted backups).
- **Patients cannot change or reset their own password online at all** — there is no
  self-service flow of any kind. Recovery is entirely physical: any older report they
  still have carries a valid username/password (or a QR code, if it hasn't expired).
  Staff can look up or regenerate a password from the admin console at any time.
- Sessions are **HS256 JWTs in httpOnly, sameSite cookies** (8 h); the proxy does
  optimistic role checks and every page/action re-verifies against the database
- The integration API authenticates with a **Bearer token**, constant-time compared,
  with separate keys for day-to-day delivery vs. historical sync — see
  [docs/API.md](docs/API.md)
- QR share grants are a **separate, scoped access mechanism** — one token views
  exactly one report's PDF, never a patient's account or history. The database
  stores only a hash of the token (never the plaintext), the URL carries it in a
  fragment (never sent to the server or logged), and the resulting session cookie
  is path-scoped to that one report's share page
- Login and integration endpoints are **rate limited**
- Patients can only query their own rows (`patientDbId` scoping in every query)
- Report PDFs live outside `public/` and are served only to the owning authenticated
  patient, an admin, or (for a QR share) a verified single-report grant
- Every sensitive action is written to the **audit log**

## Project structure

```
docs/API.md          integration API reference (auth, endpoints, report push contract)
DEPLOYMENT.md        production deploy guide
scripts/deploy.sh    install → migrate → build → start
scripts/copy-pdf-worker.mjs  syncs the pdf.js worker into public/pdfjs/ (runs on postinstall)
prisma/              schema + seed (seed refuses to run in production)
src/proxy.ts         route guard (Next 16 proxy)
src/lib/              db, session, password, device, rate-limit, audit,
                       report-storage.ts (local PDF disk I/O), report-push.ts (shared
                       ingestion core), report-share.ts (QR grant/token logic), i18n/,
                       server actions
src/components/       ui/ (buttons, fields, modals…), rb/ (animated components incl.
                       liquid-glass.tsx), portal/pdf-viewer.tsx, i18n/, admin/, portal/
src/app/
  login                           patient sign-in (no "forgot password" link — see
                                   "No online password reset" above)
  portal/                         patient dashboard, results, settings
  portal/results/[id]/file        untracked inline PDF view (what the viewer renders)
  portal/results/[id]/download    audit-logs the download, then streams the PDF
  admin/login                     staff sign-in
  admin/(console)/                dashboard (incl. Stats), patients, results, audit, settings
  r/[publicId]/                   public QR single-report viewer (no login)
  r/[publicId]/file               serves the PDF for a verified QR share session
  api/integration/patients        patient provisioning endpoint (Bearer auth)
  api/integration/reports         report delivery + QR minting + credentials (Bearer auth)
  api/integration/sync/reports    historical/bulk report import, no QR (separate Bearer key)
  api/public/report-access/       exchanges a QR token for a share session cookie
  api/health/                     liveness + DB check
```
