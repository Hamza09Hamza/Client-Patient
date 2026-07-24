# Quick manual deployment

Use this page only after the server has completed the one-time setup in
[DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Developer machine

Open the project:

```bash
cd /path/to/Clinic-Patient
nvm use
git switch main
git pull --ff-only origin main
git status
```

Review and test your changes:

```bash
./scripts/check.sh
git diff
```

Create the commit yourself:

```bash
git add path/to/file1 path/to/file2
git diff --cached
git commit -m "Describe the change"
```

Run the complete release check and push:

```bash
./scripts/push.sh
```

Stop if any check fails. Do not push with `--force`.

## 2. Enter the production server

Use the company-approved access method. Then:

```bash
cd /srv/clinic-patient/app
nvm use
git status
```

The server worktree must be clean.

## 3. Back up before migrations

```bash
set -a
. ./.env.production
set +a

BACKUP_DIR="$HOME/clinic-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --file="$BACKUP_DIR/database.dump" "$DATABASE_URL"
tar -czf "$BACKUP_DIR/reports.tar.gz" uploads/reports
ls -lh "$BACKUP_DIR"
```

Copy the backup to the approved off-server destination.

## 4. Deploy

```bash
./scripts/deploy.sh
```

This fetches `origin/main`, checks, builds, migrates, reloads PM2, and checks
`/api/health`.

## 5. Verify

```bash
./scripts/status.sh
pm2 logs clinic-patient --lines 100
```

Then test in the browser:

- Production HTTPS URL opens.
- Patient login works.
- An approved test PDF opens and downloads.
- If the integration changed, test one new upload, one identical retry, and one
  intentional conflict.

## Stop and investigate if

- `git status` shows unexpected server changes.
- A backup command fails.
- A migration fails.
- `/api/health` is not `{"status":"ok","db":"up"}`.
- PM2 is not `online`.
- Disk space is low.
- Nginx or the TLS certificate reports an error.

Useful diagnostics:

```bash
pm2 status
pm2 logs clinic-patient --lines 200
curl -v http://127.0.0.1:3000/api/health
npx prisma migrate status
sudo nginx -t
df -h
```

Do not use `git reset --hard`, force-push, `npm audit fix --force`, or
`npx prisma db seed` on production.
