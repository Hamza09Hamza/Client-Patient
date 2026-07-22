# Deployment

## What you need

- A **PostgreSQL 15+** database reachable from the app server (managed — Neon, Supabase,
  RDS, Railway — or self-hosted; `docker-compose.yml` in this repo covers the
  self-hosted case)
- A place to run a **Node.js 20+** process (a VM, a container host, or a platform like
  Railway/Render/Fly.io). Vercel also works — see the note at the bottom.
- A reverse proxy or platform edge that terminates **TLS** (Next.js itself serves plain
  HTTP; don't expose port 3000 directly to the internet)

## Environment variables

Set these on the server — don't commit them. `.env` in this repo is for local
development only (and is gitignored).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/dbname?schema=public` |
| `AUTH_SECRET` | yes | Random string, **32+ characters**. Signs patient/admin session cookies. Generate with `openssl rand -base64 48`. Rotating it logs everyone out. |
| `INTEGRATION_API_KEY` | yes | Random string, **16+ characters**. Shared secret for `/api/integration/*` (see [docs/API.md](docs/API.md)). Generate with `openssl rand -hex 32`. |
| `SMTP_*` | no | Only needed if you wire up automated emails later; unused today (the admin console currently generates a `mailto:` link instead) |

## Deploy

```bash
git clone <this-repo> && cd Clinic-Patient
DATABASE_URL="postgresql://..." \
AUTH_SECRET="$(openssl rand -base64 48)" \
INTEGRATION_API_KEY="$(openssl rand -hex 32)" \
  ./scripts/deploy.sh
```

`scripts/deploy.sh` does, in order:
1. Validates the three required env vars are set and long enough
2. `npm ci`
3. `prisma generate`
4. `prisma migrate deploy` — applies pending migrations, safe to re-run, **does not
   touch existing data**
5. `npm run build`
6. Starts the server: `next start --hostname 0.0.0.0 --port ${PORT:-3000}`

Re-run the same script for every subsequent deploy (new migrations are picked up
automatically; nothing is destroyed).

### First deploy only: create the admin account

The seed script (`prisma/seed.ts`) creates realistic **demo** data — it deletes
existing rows first, so it must never run against a real clinic database. It
refuses to run when `NODE_ENV=production` unless you explicitly pass
`ALLOW_PROD_SEED=true`. For a first deploy, create the one real admin account by hand
instead:

```bash
DATABASE_URL="postgresql://..." node -e '
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
db.admin.create({
  data: { username: "admin", fullName: "Clinic Administrator", password: "<choose-a-strong-password>" },
}).then(() => console.log("admin created")).finally(() => db.\$disconnect());
'
```

Sign in once and change that password from the console (Settings → Console
password).

### Health check

`GET /api/health` returns `{"status":"ok","db":"up"}` (200) or a 503 if the database
is unreachable — point your load balancer / process manager at it.

### Keeping it running

`scripts/deploy.sh` ends by running the server in the foreground (`exec next start`)
so a process manager can supervise it directly:

- **systemd**: `ExecStart=/path/to/scripts/deploy.sh`, `Restart=on-failure`
- **pm2**: `pm2 start scripts/deploy.sh --name clinic-portal`
- **Docker**: use the deploy script as the container `CMD` (build a small Node 20
  image, `COPY` the repo, run `npm ci` at image-build time to keep startup fast,
  then `CMD ["./scripts/deploy.sh"]`)

### Uploaded ID photos

Patient-submitted ID photos for password-reset requests are written to
`./uploads/` on the server's local disk (never under `public/` — they're served
only to authenticated admins via `/admin/files/[name]`). On a multi-instance or
ephemeral-filesystem deployment (serverless, container platforms that don't
persist disk), point this at a persistent volume or adapt
`src/app/forgot-password/actions.ts` and `src/app/admin/files/[name]/route.ts` to
use object storage (S3-compatible) instead.

### Vercel note

The app is a standard Next.js App Router project and deploys to Vercel with the
same env vars. Two adjustments:
- Uploaded ID photos need object storage (see above) — Vercel's filesystem isn't
  persistent across deployments/instances.
- Run migrations from CI/your machine (`npx prisma migrate deploy`) rather than
  from `scripts/deploy.sh`, since Vercel doesn't run a long-lived shell as part of
  its build.

## Security notes for production

- **Passwords are stored in plaintext** in this system, by product decision (so
  admins can view a patient's current password, not just regenerate it — see
  README → Security). This makes the database itself the single point of
  failure. Compensate for it:
  - Enable encryption at rest on the database (most managed Postgres providers do
    this by default — confirm it).
  - Restrict database network access to the app server only (VPC/security group,
    no public endpoint).
  - Encrypt backups, and restrict who can restore/read them.
  - Limit who has `SELECT` access on the `Patient`/`Admin` tables in production.
- Put the app behind TLS end-to-end; session cookies are only marked `Secure`
  when `NODE_ENV=production`, which `scripts/deploy.sh` sets.
- Rotate `AUTH_SECRET` and `INTEGRATION_API_KEY` if either is ever exposed
  (commit history, logs, a leaked `.env`).
