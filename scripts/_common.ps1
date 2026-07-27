# Common helpers for Windows deployment scripts (Windows PowerShell 5.1+ / PowerShell 7+).
# Mirrors scripts/_common.sh so Windows and Linux servers follow the same rules.

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Write-Log {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Die {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "error: $Message" -ForegroundColor Red
    exit 1
}

function Require-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Die "Required command is missing: $Name"
    }
}

function Require-Node20 {
    Require-Command node
    $version = (node -p "process.versions.node").Trim()
    $parts = $version.Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    if ($major -ne 20 -or $minor -lt 19) {
        Die ("Node 20.19.x is required; found v$version. On Windows, manage versions with " +
             "nvm-windows (https://github.com/coreybutler/nvm-windows) or install the Node " +
             "20.19.0 MSI directly from nodejs.org if Chocolatey's unattended install fails.")
    }
}

function Require-CleanWorktree {
    $status = git status --porcelain
    if ($status) {
        git status --short
        Die "The Git worktree must be clean. Commit or intentionally stash your changes first."
    }
}

function Load-ProductionEnv {
    $envFile = $env:ENV_FILE
    if (-not $envFile) {
        $candidate = Join-Path $ProjectRoot ".env.production"
        if (Test-Path $candidate) {
            $envFile = $candidate
        } else {
            $envFile = Join-Path $ProjectRoot ".env"
        }
    }
    if (-not (Test-Path $envFile)) {
        Die "Environment file not found: $envFile"
    }

    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $matches[1]
            $value = $matches[2].Trim()
            if ($value.Length -ge 2 -and (
                    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                    ($value.StartsWith("'") -and $value.EndsWith("'"))
                )) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

function Validate-ProductionEnv {
    foreach ($name in @("DATABASE_URL", "AUTH_SECRET", "INTEGRATION_API_KEY", "REPORT_SHARE_ENCRYPTION_KEY", "PUBLIC_BASE_URL")) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ([string]::IsNullOrEmpty($value)) {
            Die "Missing required production variable: $name"
        }
    }
    if ($env:AUTH_SECRET.Length -lt 32) {
        Die "AUTH_SECRET must be at least 32 characters."
    }
    if ($env:INTEGRATION_API_KEY.Length -lt 16) {
        Die "INTEGRATION_API_KEY must be at least 16 characters."
    }
    if ($env:REPORT_SHARE_ENCRYPTION_KEY.Length -lt 32) {
        Die "REPORT_SHARE_ENCRYPTION_KEY must be at least 32 characters."
    }
    if ($env:AUTH_SECRET -eq $env:INTEGRATION_API_KEY) {
        Die "AUTH_SECRET and INTEGRATION_API_KEY must differ."
    }
    if ($env:AUTH_SECRET -eq $env:REPORT_SHARE_ENCRYPTION_KEY) {
        Die "AUTH_SECRET and REPORT_SHARE_ENCRYPTION_KEY must differ."
    }
    if ($env:INTEGRATION_API_KEY -eq $env:REPORT_SHARE_ENCRYPTION_KEY) {
        Die "INTEGRATION_API_KEY and REPORT_SHARE_ENCRYPTION_KEY must differ."
    }
    if ($env:PUBLIC_BASE_URL -notmatch '^https://') {
        Die "PUBLIC_BASE_URL must be the canonical HTTPS origin."
    }
}
