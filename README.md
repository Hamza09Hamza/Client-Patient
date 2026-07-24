# Clinique Amina — Laboratory Results Website

A patient-facing website where clinic patients securely view, filter, and download
their laboratory results — as PDFs pushed from the clinic's own system — plus a
token-protected integration API for the clinic's internal systems. There is no staff
web console: every patient and report is provisioned entirely through that API, from
the clinic's own internal system. Bilingual (French/English).

Built with **Next.js 16 (App Router, TypeScript)**, **PostgreSQL + Prisma**,
**Tailwind CSS 4**, **Motion** (animations), and **Lucide** icons.

The clinic name is centralized in `src/lib/config.ts` (`CLINIC_NAME`) — change it
once and the portal branding updates. Report PDFs themselves come from the clinic's
system and are not generated or rewritten by this app.

## Features

### Patient portal (`/portal`)
- Sign in with a **generated username + password** — both short, random 8-character
  codes drawn from unambiguous letters and digits, so they're quick to read and type.
  They are separate from the clinic's own `patientId`, which only ties reports to the
  right account and is never used to log in
- **Bilingual UI** — French/English switcher (top-right on every page), cookie-persisted
- Overview dashboard: stat tiles, latest reports
- Full history with **search, category/status filters, date range, sorting, pagination**
- Report detail: a **custom-built PDF viewer** (page nav, zoom, thumbnails, fullscreen — not
  the browser's native plugin) for reports pushed from the clinic's own system. No
  structured values are entered or shown anywhere in the app — every report is the
  clinic's own PDF
- **No online password reset.** Patients never set their own password, and there's no
  in-app recovery flow — every physical report the clinic hands out is printed with a QR
  code (see "QR single-report sharing" below). Recovery is the clinic's own
  responsibility. Server B generates credentials only when the patient is first
  provisioned; it has no password-change or password-rotation operation

### Clinic report push (`/api/integration/reports`)
Reports arrive as PDFs pushed **from** the clinic's own internal system (LIS/HIS) —
this app never calls out to fetch them. Each call sends a batch (up to 10) of
`{ patientId, externalId, title, collectedAt, ... }` metadata entries alongside their
PDF bytes as multipart file parts; this app stores each file locally under
`uploads/reports/` (identified by patient + `externalId`) and shows it in the patient's
results list through the built-in PDF viewer. Reports are append-only: an identical
retry returns `already_stored` without writing another file, while reusing the same
`externalId` for different PDF bytes returns `conflict`. A corrected document must
have a new `externalId`. This direction
works even when this app's VM has no outbound path into the clinic's network.
Every push also mints a **QR share grant** per report — a scoped, revocable link
that shows just that one PDF with no patient login (see "QR single-report sharing"
below). See **[docs/API.md → Report
delivery](docs/API.md#report-delivery--post-apiintegrationreports)** for
the full request/response shape.

### QR single-report sharing (`/r/[publicId]`)
Every report delivered gets a scan-to-view link — no patient login, scoped to that
one report only, expiring after 30 days, revocable, re-scannable within that window.
The token travels in the URL fragment (never sent to the server on page load) and
is exchanged client-side for a short-lived, path-scoped session cookie. Full flow
and security notes:
**[docs/API.md → QR single-report sharing](docs/API.md#qr-single-report-sharing)**.

### Integration API (`/api/integration/patients`, `/api/integration/reports`)
For the clinic's internal system (LIS/HIS) to provision patient accounts and then push
their reports. Requests authenticate with a single Bearer token.
Full reference, request/response shape, and error codes: **[docs/API.md](docs/API.md)**
— or **[docs/INTEGRATION-GUIDE.md](docs/INTEGRATION-GUIDE.md)** for a plain-language
walkthrough to hand to whoever operates that system.

```bash
# Verify/create a patient and receive generated login credentials
curl -X POST https://patients.example.com/api/integration/patients \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"patientId":"PAT-2026-0200","fullName":"Jane Doe","email":"jane@example.com"}'
# -> {"patientId":"PAT-2026-0200","username":"k7mXq2wR","fullName":"Jane Doe","password":"b8WD2Zmy","created":true}
# Posting an existing patientId is idempotent and never changes or returns the password.
```

## Getting started

```bash
npm install
cp .env.example .env

# Database — either use a local PostgreSQL and set DATABASE_URL in .env,
# or start the bundled Docker service (listens on host port 5433):
docker compose up -d

npx prisma migrate dev   # create schema
npx prisma db seed       # demo data
npm run dev              # http://localhost:3000
```
### Where the database actually lives (local dev)
`DATABASE_URL` in `.env` decides this. The committed `.env.example` points at
the bundled Docker PostgreSQL service on host port `5433`. If your existing
local `.env` points at `postgresql://postgres@localhost:5432/clinic_portal`, on macOS
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

Set real values before deploying: `DATABASE_URL`, `AUTH_SECRET`
(32+ random chars, also signs QR share sessions), and `INTEGRATION_API_KEY` (16+
random chars — authenticates `/api/integration/patients` and
`/api/integration/reports`); see [docs/API.md](docs/API.md). `PUBLIC_BASE_URL` sets
the origin baked into generated QR URLs. It may fall back to the request origin
in development, but production refuses report ingestion unless it is an explicit
HTTPS origin.

### Demo credentials (seed data)

| Role | Username | Password |
|---|---|---|
| Patient | `demo0001` | `Demo2026` |

(Patient record `PAT-2026-0001` — the clinic id, not the login username.)

## Security model

- **Passwords are hashed at rest** (scrypt, random salt per patient —
  `src/lib/password.ts`) and never stored or retrievable in plaintext afterward. The
  plaintext exists only once, in memory, when a patient is first created, and is
  returned exactly then in the `POST /api/integration/patients` response for the
  clinic's own system (SERVER A) to keep — see [docs/API.md → POST
  /api/integration/patients](docs/API.md#post-apiintegrationpatients). This app never
  re-sends it, rotates it, or has any way to look it up again.
- **Patients cannot change or reset their own password online at all** — there is no
  self-service flow of any kind, and there is no staff console either. Recovery is
  entirely the clinic's own responsibility and outside this application's current
  feature set.
- Sessions are **HS256 JWTs in httpOnly, sameSite cookies** (8 h); the proxy does
  optimistic role checks and every page/action re-verifies against the database.
  A malformed, expired, disabled-patient, or deleted-patient session is expired in
  the browser before redirecting to `/login`, preventing stale-cookie redirect loops
- The integration API authenticates with a single **Bearer token**, constant-time
  compared — see [docs/API.md](docs/API.md)
- QR share grants are a **separate, scoped access mechanism** — one token views
  exactly one report's PDF, never a patient's account or history. The database
  stores only a hash of the token (never the plaintext), the URL carries it in a
  fragment (never sent to the server or logged), and the resulting session cookie
  is path-scoped to that one report's share page
- Login and integration endpoints are **rate limited**
- Patients can only query their own rows (`patientDbId` scoping in every query)
- Report PDFs live outside `public/` and are served only to the owning authenticated
  patient, or (for a QR share) a verified single-report grant
- Successful provisioning, report delivery, login/logout, report views/downloads,
  and QR redemptions are written to the **audit log**. Audit writes are best-effort
  and never expose passwords or QR tokens.

## Project structure

```
docs/API.md          integration API reference (auth, endpoints, report push contract)
docs/INTEGRATION-GUIDE.md  plain-language walkthrough for the clinic's system operator
DEPLOYMENT.md        production deploy guide
QUICK-DEPLOY.md      short repeat-deployment checklist after server setup
scripts/check.sh     local fast or full release verification
scripts/push.sh      verifies and pushes the current committed branch
scripts/deploy.sh    manual in-server pull → check → build → migrate → PM2 reload
scripts/status.sh    read-only server, PM2, health, migration, and disk diagnostics
scripts/copy-pdf-worker.mjs  syncs the pdf.js worker into public/pdfjs/ (runs on postinstall)
prisma/              schema + seed (seed refuses to run in production)
src/proxy.ts         route guard (Next 16 proxy)
src/lib/              db, session, password (generation + hashing), device,
                       rate-limit, audit, report-storage.ts (local PDF disk I/O),
                       report-share.ts (QR grant/token logic), i18n/, server actions
src/components/       ui/ (buttons, fields, modals…), rb/ (animated components),
                       portal/pdf-viewer.tsx, i18n/, portal/
src/app/
  login                           patient sign-in (no "forgot password" link — see
                                   "No online password reset" above)
  portal/                         patient dashboard, results, settings
  portal/results/[id]/file        untracked inline PDF view (what the viewer renders)
  portal/results/[id]/download    audit-logs the download, then streams the PDF
  r/[publicId]/                   public QR single-report viewer (no login)
  r/[publicId]/file               serves the PDF for a verified QR share session
  api/integration/patients        idempotent patient provisioning endpoint (Bearer auth)
  api/integration/reports         report delivery + QR minting (Bearer auth)
  api/public/report-access/       exchanges a QR token for a share session cookie
  api/health/                     liveness + DB check
```
