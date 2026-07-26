<#
Run manually from inside the production server repository (Windows).
Fast-forwards from origin/main, validates, builds, migrates, restarts the
NSSM-managed Windows service, and verifies the health endpoint.

Requires: git, node, npm, npx, nssm on PATH. The NSSM service must already be
registered once (see WINDOWS-DEPLOY notes) — this script restarts it, it does
not create it.
#>

. "$PSScriptRoot\_common.ps1"
Set-Location $ProjectRoot

Require-Command git
Require-Command npm
Require-Command npx
Require-Command nssm
Require-Node20
Require-CleanWorktree

$lockFile = Join-Path $env:TEMP "clinic-patient-deploy.lock"
if (Test-Path $lockFile) {
    $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
    if ($age.TotalMinutes -lt 30) {
        Die "Another deployment appears to be running (lock file: $lockFile, age: $([int]$age.TotalMinutes) min). Delete it manually only if you are sure it is stale."
    }
}
New-Item -ItemType File -Path $lockFile -Force | Out-Null

try {
    Load-ProductionEnv
    Validate-ProductionEnv
    $env:NODE_ENV = "production"
    $env:NEXT_TELEMETRY_DISABLED = "1"

    $remote = if ($env:GIT_REMOTE) { $env:GIT_REMOTE } else { "origin" }
    $branch = if ($env:DEPLOY_BRANCH) { $env:DEPLOY_BRANCH } else { "main" }
    $serviceName = if ($env:NSSM_SERVICE_NAME) { $env:NSSM_SERVICE_NAME } else { "clinic-patient" }
    $port = if ($env:PORT) { $env:PORT } else { "3000" }
    $healthUrl = if ($env:HEALTH_URL) { $env:HEALTH_URL } else { "http://127.0.0.1:$port/api/health" }

    $currentBranch = (git symbolic-ref --quiet --short HEAD 2>$null)
    if (-not $currentBranch) { Die "The server repository is on a detached HEAD." }
    if ($currentBranch -ne $branch) { Die "Expected branch '$branch', but the server is on '$currentBranch'." }

    $before = (git rev-parse HEAD).Trim()

    Write-Log "Fetching $remote/$branch"
    git fetch --prune $remote $branch
    if ($LASTEXITCODE -ne 0) { Die "git fetch failed" }
    $target = (git rev-parse "refs/remotes/$remote/$branch").Trim()

    if ($before -eq $target) {
        Write-Log "Server already has the latest commit"
    } else {
        git merge-base --is-ancestor $before $target
        if ($LASTEXITCODE -ne 0) {
            Die "The remote update is not a fast-forward. Resolve it manually; deployment made no changes."
        }
        Write-Log "Fast-forwarding to $target"
        git merge --ff-only $target
        if ($LASTEXITCODE -ne 0) { Die "git merge --ff-only failed" }
    }

    Write-Log "Installing the exact locked dependencies"
    npm ci --include=dev
    if ($LASTEXITCODE -ne 0) { Die "npm ci failed" }

    Write-Log "Running application checks"
    npm run check
    if ($LASTEXITCODE -ne 0) { Die "npm run check failed" }

    Write-Log "Checking shipped dependencies for high or critical advisories"
    npm audit --omit=dev --audit-level=high
    if ($LASTEXITCODE -ne 0) { Die "npm audit found high/critical advisories" }

    Write-Log "Building the production application"
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "npm run build failed" }

    Write-Log "Applying pending database migrations"
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Die "prisma migrate deploy failed" }

    nssm status $serviceName *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Restarting Windows service: $serviceName"
        nssm restart $serviceName
        if ($LASTEXITCODE -ne 0) { Die "nssm restart failed" }
    } else {
        Die ("Service '$serviceName' is not registered yet. Register it once, e.g.:`n" +
             "  nssm install $serviceName `"C:\Program Files\nodejs\npm.cmd`" `"run start`"`n" +
             "  nssm set $serviceName AppDirectory `"$ProjectRoot`"`n" +
             "  nssm set $serviceName AppEnvironmentExtra NODE_ENV=production`n" +
             "  nssm start $serviceName")
    }

    Write-Log "Waiting for $healthUrl"
    $healthy = $false
    for ($i = 0; $i -lt 20; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { $healthy = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if (-not $healthy) {
        Write-Host "Deployment reached commit $target, but its health check failed." -ForegroundColor Red
        Write-Host "Inspect: nssm status $serviceName"
        Write-Host "Logs: check the AppStdout/AppStderr paths set on the NSSM service"
        exit 1
    }

    Write-Log "Deployment healthy"
    Write-Host "Previous commit: $before"
    Write-Host "Running commit:  $target"
}
finally {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
