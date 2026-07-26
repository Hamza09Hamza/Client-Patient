<#
Local verification (Windows):
  .\scripts\check.ps1            fast checks using installed dependencies
  .\scripts\check.ps1 -Release   clean install, checks, build, production audit
#>
param(
    [switch]$Release
)

. "$PSScriptRoot\_common.ps1"
Set-Location $ProjectRoot

Require-Command npm
Require-Command npx
Require-Node20

if ($Release) {
    Write-Log "Installing the exact locked dependency tree"
    npm ci --include=dev
    if ($LASTEXITCODE -ne 0) { Die "npm ci failed" }
}

Write-Log "Running lint, TypeScript, tests, and Prisma validation"
npm run check
if ($LASTEXITCODE -ne 0) { Die "npm run check failed" }

if ($Release) {
    Write-Log "Building the production application"
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "npm run build failed" }

    Write-Log "Checking shipped dependencies for high or critical advisories"
    npm audit --omit=dev --audit-level=high
    if ($LASTEXITCODE -ne 0) { Die "npm audit found high/critical advisories" }
}

Write-Log "Verification passed"
