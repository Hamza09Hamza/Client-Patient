# Deployment runbook

This application is deployed manually because the production network does not
accept inbound deployment connections.

```text
Developer machine                         Production server
-----------------                         -----------------
check → commit → verified push    then    fetch → check → build
                                                → migrate → PM2 reload
```

Nothing deploys automatically.

Already configured the server? Use [QUICK-DEPLOY.md](QUICK-DEPLOY.md). It is the
short checklist to use when returning after a break.

## Write down these facts first

Fill this in when server access is provided. Do not record secrets here.

```text
Server operating system:
Approved access method:
Portal domain:
Repository URL:
Application directory:
Linux application user:
PM2 application name: clinic-patient
PostgreSQL location:
Off-server backup destination:
Nginx configuration path:
Person to contact if deployment fails:
```

## Expected production layout

```text
Internet → Nginx HTTPS → Next.js managed by PM2 on 127.0.0.1:3000
                                      ├── PostgreSQL
                                      └── uploads/reports
```

Use one Server B instance for now. Do not expose port `3000` publicly.

Required software:

- Node.js 20.19.x
- npm and Git
- PostgreSQL 15+ and `pg_dump`
- PM2
- Nginx with TLS
- `curl`
- Linux `flock` from `util-linux`
- Persistent storage for `uploads/reports`

The server also needs outbound access to the Git repository host and the npm
registry. The current build may need access to Google Fonts. It does not need to
accept inbound SSH from GitHub or another CI service.

## First-time server setup

The commands below assume Ubuntu/Debian and appropriate `sudo` access. For another
distribution, use its equivalent packages.

### 1. Inspect the server

Run these before changing anything:

```bash
cat /etc/os-release
uname -m
whoami
pwd
git --version
node --version
npm --version
pm2 --version
nginx -v
psql --version
```

Missing commands are normal on a new server.

### 2. Install base tools

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql-client util-linux build-essential
```

Install NVM using its official instructions if it is not already installed. Then,
as the non-root Linux user that will run the application:

```bash
nvm install 20
nvm alias default 20
nvm use 20
node --version

npm install --global pm2
pm2 --version
```

Node must print `v20.19.x` or a later Node 20 release. Do not run the application
as `root`.

### 3. Clone the repository

Replace `REPLACE_WITH_REPOSITORY_URL`:

```bash
sudo mkdir -p /srv/clinic-patient
sudo chown "$USER":"$USER" /srv/clinic-patient

git clone REPLACE_WITH_REPOSITORY_URL /srv/clinic-patient/app
cd /srv/clinic-patient/app
git switch main
git fetch origin main
git status
```

For a private repository, use a company-approved read-only credential or deploy
key. The server needs outbound Git access; Git does not need inbound access to the
server.

### 4. Create the production environment

```bash
cd /srv/clinic-patient/app
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

Replace every example value:

```dotenv
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME
AUTH_SECRET=RANDOM_SECRET_AT_LEAST_32_CHARACTERS
INTEGRATION_API_KEY=DIFFERENT_RANDOM_API_KEY
PUBLIC_BASE_URL=https://PATIENT_PORTAL_DOMAIN
HOST=127.0.0.1
PORT=3000
PM2_APP_NAME=clinic-patient
```

The deployment scripts load this file as a shell environment file. Keep each
entry in `KEY=value` form, quote values that contain shell spaces or special
characters, and URL-encode special characters inside the database username or
password.

Generate two unrelated secrets:

```bash
openssl rand -base64 48
openssl rand -hex 32
```

Use one output for `AUTH_SECRET` and the other for `INTEGRATION_API_KEY`.

Load the environment and test PostgreSQL:

```bash
set -a
. ./.env.production
set +a
psql "$DATABASE_URL" -c 'SELECT 1;'
```

Do not continue until the database connection succeeds.

### 5. Review migrations

Install the locked dependencies and inspect migration state:

```bash
npm ci --include=dev
npx prisma migrate status
```

On a new empty database, pending migrations are expected.

Important: the early migrations
`20260723142849_admin_removal_and_password_hashing` and
`20260723152513_add_patient_username` delete existing patient rows because they
were written while the database contained only demo data. Cascading foreign keys
also delete those patients' reports and QR grants.

If this is an older populated database and those migrations are pending, stop.
Prepare a non-destructive migration plan before deployment.

Never run this on staging or production:

```bash
npx prisma db seed
```

The seed deletes application data before creating demo records.

### 6. Create the first backup

The approved backup destination must eventually be outside the application
server. This command creates a temporary manual backup:

```bash
BACKUP_DIR="$HOME/clinic-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

pg_dump --format=custom --file="$BACKUP_DIR/database.dump" "$DATABASE_URL"

mkdir -p uploads/reports
tar -czf "$BACKUP_DIR/reports.tar.gz" uploads/reports

ls -lh "$BACKUP_DIR"
```

Confirm both files have non-zero sizes, then copy them to the approved off-server
destination. Database backups do not contain PDF bytes.

### 7. Run the first deployment

```bash
./scripts/deploy.sh
./scripts/status.sh
```

The deploy script:

1. Refuses dirty server files or simultaneous deployments.
2. Fetches only a fast-forward update from `origin/main`.
3. Installs the exact lockfile.
4. Runs lint, TypeScript, tests, Prisma validation, and dependency audit.
5. Builds before changing the database.
6. Applies pending migrations.
7. Starts or reloads PM2.
8. Checks `/api/health`.

Confirm manually:

```bash
pm2 status
pm2 logs clinic-patient --lines 100
curl --fail http://127.0.0.1:3000/api/health
```

Expected health response:

```json
{"status":"ok","db":"up"}
```

### 8. Make PM2 survive reboots

```bash
pm2 startup
```

PM2 prints a `sudo` command tailored to the current user and OS. Review and run
that generated command, then:

```bash
pm2 save
```

PM2 documents this `pm2 startup` followed by `pm2 save` workflow in its
[startup guide](https://pm2.keymetrics.io/docs/usage/startup/).

Test reboot recovery only during an approved maintenance window.

### 9. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/clinic-patient
```

Replace `PATIENT_PORTAL_DOMAIN`:

```nginx
server {
    listen 80;
    server_name PATIENT_PORTAL_DOMAIN;

    client_max_body_size 105m;
    client_body_timeout 60s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_request_buffering on;
        proxy_connect_timeout 5s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Enable and validate:

```bash
sudo ln -s /etc/nginx/sites-available/clinic-patient /etc/nginx/sites-enabled/clinic-patient
sudo nginx -t
sudo systemctl reload nginx
```

Never reload Nginx if `nginx -t` fails.

Obtain the TLS certificate through the company-approved process. If Certbot is
approved, use its [official OS-specific installation instructions](https://certbot.eff.org/instructions),
then normally:

```bash
sudo certbot --nginx -d PATIENT_PORTAL_DOMAIN
sudo nginx -t
sudo systemctl reload nginx
```

Confirm that HTTP redirects to HTTPS before allowing SERVER A to upload reports.

### 10. Smoke-test production

```bash
./scripts/status.sh
curl --fail https://PATIENT_PORTAL_DOMAIN/api/health
```

Using an approved test patient, verify:

- Patient provisioning returns credentials once.
- Patient login works.
- A new PDF upload returns `stored`.
- An identical retry returns `already_stored`.
- Different bytes under the same report ID return `conflict`.
- The QR opens only that report.
- Inline PDF view and download work.

## Routine deployment

Use [QUICK-DEPLOY.md](QUICK-DEPLOY.md). In summary:

On the developer machine:

```bash
cd /path/to/Clinic-Patient
nvm use
git switch main
git pull --ff-only origin main

./scripts/check.sh
git status
git add path/to/file1 path/to/file2
git diff --cached
git commit -m "Describe the change"
./scripts/push.sh
```

On the production server:

```bash
cd /srv/clinic-patient/app
nvm use
git status

# Back up PostgreSQL and uploads/reports first.
./scripts/deploy.sh
./scripts/status.sh
```

Nothing deploys until a person runs `deploy.sh` inside the server.

## Script reference

| Command | Where | Purpose |
|---|---|---|
| `./scripts/check.sh` | developer | Fast lint, types, tests, and Prisma validation |
| `./scripts/check.sh --release` | developer | Clean install, full checks, build, dependency audit |
| `./scripts/push.sh` | developer | Full release check, confirmation, then pushes the committed branch |
| `./scripts/deploy.sh` | server | Fetch, verify, build, migrate, PM2 reload, health check |
| `./scripts/status.sh` | server | Read-only Git, PM2, health, migration, and disk diagnostics |

`push.sh` never stages or commits files. `deploy.sh` never accepts a dirty server
worktree or a non-fast-forward update.

## Troubleshooting

### Dirty server worktree

```bash
git status
git diff
```

Do not use `git reset --hard`. Investigate who changed the files.

### Wrong Node version

```bash
nvm install 20
nvm use 20
node --version
```

### Git fetch failure

```bash
git remote -v
git fetch origin main
```

Check outbound network access and repository credentials.

### Dependency or audit failure

```bash
npm ci --include=dev
npm audit --omit=dev
```

Do not run `npm audit fix --force` on production. Fix and test dependencies on
the developer machine.

### Build failure

```bash
npm run check
npm run build
```

Read the first actual error.

### Database or migration failure

```bash
set -a
. ./.env.production
set +a
psql "$DATABASE_URL" -c 'SELECT 1;'
npx prisma migrate status
```

Stop and investigate. Never mark a failed migration as applied just to remove the
warning.

### PM2 or health failure

```bash
pm2 status
pm2 logs clinic-patient --lines 200
curl -v http://127.0.0.1:3000/api/health
```

### Nginx or public HTTPS failure

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx --since "30 minutes ago"
curl -I https://PATIENT_PORTAL_DOMAIN
```

### Low disk space

```bash
df -h
du -sh uploads/reports
```

Do not manually delete medical PDFs. Expand storage or use an approved
database-aware retention process.

## Safe rollback for this manual version

There is no automatic rollback yet.

If application code is bad:

1. Stop new uploads if they could be affected.
2. Save the commit SHA, logs, health response, and migration status.
3. On the developer machine, use `git revert` to create a new corrective commit.
4. Run `./scripts/check.sh --release`.
5. Push the revert commit.
6. Run `./scripts/deploy.sh` again on the server.

Do not force-push or use `git reset --hard` on production.

Reverting code does not reverse database migrations. If an incompatible migration
was applied, use a reviewed recovery plan and the coordinated PostgreSQL/PDF
backup rather than improvising a down migration.

## Operations still required

The scripts do not replace:

- Automated PostgreSQL backups and tested restores.
- Versioned off-server backups of `uploads/reports`.
- Disk, certificate, database, PM2 restart, and HTTP 5xx monitoring.
- Restricted medical-data log access and retention.
- Incident procedures for exposed keys, missing PDFs, or failed migrations.
- A staging environment when the organization is ready for one.
