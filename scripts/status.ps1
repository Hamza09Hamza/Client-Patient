<#
Read-only production diagnostics for Windows. Run from inside the server repository.
#>

. "$PSScriptRoot\_common.ps1"
Set-Location $ProjectRoot

Require-Command git
Require-Command nssm
Require-Command npx
Load-ProductionEnv
$env:NODE_ENV = "production"

$serviceName = if ($env:NSSM_SERVICE_NAME) { $env:NSSM_SERVICE_NAME } else { "clinic-patient" }
$port = if ($env:PORT) { $env:PORT } else { "3000" }
$healthUrl = if ($env:HEALTH_URL) { $env:HEALTH_URL } else { "http://127.0.0.1:$port/api/health" }

Write-Log "Repository"
git status --short --branch
git log -1 --format="commit: %H%nsubject: %s%ndate: %cI"

Write-Log "Windows service ($serviceName)"
nssm status $serviceName

Write-Log "Application health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    Write-Host $response.Content
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
}

Write-Log "Database migration status"
npx prisma migrate status

Write-Log "Report storage"
$uploadsPath = Join-Path $ProjectRoot "uploads"
if (Test-Path $uploadsPath) {
    $sizeBytes = (Get-ChildItem -Recurse -File $uploadsPath | Measure-Object -Property Length -Sum).Sum
    $sizeMb = [math]::Round(($sizeBytes / 1MB), 2)
    Write-Host "uploads/ size: $sizeMb MB"
} else {
    Write-Host "uploads/ directory does not exist yet."
}
$drive = (Get-Item $ProjectRoot).PSDrive
Get-PSDrive -Name $drive.Name | Select-Object Name, @{N = "UsedGB"; E = { [math]::Round($_.Used / 1GB, 1) } }, @{N = "FreeGB"; E = { [math]::Round($_.Free / 1GB, 1) } } | Format-Table
