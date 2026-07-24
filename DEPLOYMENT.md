# Deployment

This application is a patient portal plus a server-to-server integration API.
There is no admin console: the clinic's own system (SERVER A) provisions patients
and sends report PDFs to this application (SERVER B).

## Requirements

- Node.js 20+
- PostgreSQL 15+
- A persistent filesystem volume for `uploads/reports/`
- A reverse proxy or platform edge that terminates TLS

Do not expose the Next.js process on port 3000 directly to the internet.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Random value of at least 32 characters; signs patient and QR-share session cookies |
| `INTEGRATION_API_KEY` | yes | Random value of at least 16 characters; authenticates SERVER A |
| `PUBLIC_BASE_URL` | production | Public HTTPS origin placed in generated QR URLs, for example `https://patients.example.com` |
| `PORT` | no | Next.js port, default `3000` |
| `HOST` | no | Bind address, default `0.0.0.0` |

Generate secrets outside the repository:

```bash
openssl rand -base64 48  # AUTH_SECRET
openssl rand -hex 32     # INTEGRATION_API_KEY
```

Never place these values in source code, client-side applications, URLs, or logs.

## Database migration warning

Always back up the database before applying migrations.

The early development migrations
`20260723142849_admin_removal_and_password_hashing` and
`20260723152513_add_patient_username` delete existing patient rows because the
database contained demo data when those migrations were written. Through cascading
foreign keys, that also deletes those patients' reports and QR grants.

For a new empty installation, applying the full migration history is expected. For
an older populated installation that has not already applied those migrations, do
not run `prisma migrate deploy` until the data has been backed up and a non-destructive
data migration has been prepared.

Check migration state before deployment:

```bash
npx prisma migrate status
```

## Deploy

With the required environment variables already exported:

```bash
./scripts/deploy.sh
```

The script:

1. Validates required environment variables.
2. Installs the locked dependency tree with `npm ci`.
3. Generates the Prisma client.
4. Applies pending migrations.
5. Builds the production Next.js application.
6. Starts `next start` in the foreground.

Run it under a process manager such as systemd, PM2, or a container supervisor.

## Patient provisioning

There is no application-side administrator to create accounts. SERVER A calls:

```text
POST /api/integration/patients
```

For a new patient, Server B generates a username and password, stores only the
scrypt password hash, and returns the plaintext password once in that response.
Calling the endpoint again for the same `patientId` is idempotent: it returns the
existing username and does not change or return the password.

Do not run the seed script in a real environment. It deletes all patients, reports,
QR grants, and audit logs before installing demo data. It refuses to run when
`NODE_ENV=production` unless `ALLOW_PROD_SEED=true`, but staging and other
non-production environments still require care.

## Persistent report storage

Integrated PDFs are stored under:

```text
uploads/reports/
```

Mount that directory on durable storage and restrict filesystem access to the
application's operating-system user. Database backups alone do not contain the PDF
bytes; back up the database and report volume together.

For multiple Server B instances, use a shared persistent volume or replace
`src/lib/report-storage.ts` with object storage. Instance-local disks will otherwise
serve different subsets of reports.

Vercel and other ephemeral/serverless filesystems are not supported by the current
local-storage implementation. They require an object-storage adapter before
production use.

## Reverse proxy limits

SERVER A normally sends 5–7 reports together. Server B accepts at most 10 reports,
25 MB per PDF, and 100 MB of PDF data per request. Configure the reverse proxy with
a compatible request-body limit slightly above 100 MB to allow multipart overhead.

TLS must remain enabled end-to-end. Configure the proxy to replace, rather than
append arbitrary client values to, forwarding headers such as `X-Forwarded-For`.

## Health check

```text
GET /api/health
```

Successful response:

```json
{"status":"ok","db":"up"}
```

A database failure returns HTTP `503`.

## Production checklist

- Back up PostgreSQL and `uploads/reports/`.
- Confirm migration state before deployment.
- Set `PUBLIC_BASE_URL` to the canonical HTTPS origin.
- Restrict database access to Server B.
- Restrict report-directory permissions to the Server B OS user.
- Terminate TLS at a trusted reverse proxy.
- Configure the proxy request-body limit.
- Rotate `AUTH_SECRET` and `INTEGRATION_API_KEY` if either is exposed.
- Point monitoring at `/api/health`.
