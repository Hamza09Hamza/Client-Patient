<#
Verifies and pushes the current committed branch. Never creates commits.
Usage: .\scripts\push.ps1 [-Yes]
#>
param(
    [switch]$Yes
)

. "$PSScriptRoot\_common.ps1"
Set-Location $ProjectRoot

Require-Command git
Require-CleanWorktree

$branch = (git symbolic-ref --quiet --short HEAD 2>$null)
if (-not $branch) { Die "Detached HEAD cannot be pushed by this script." }
$remote = if ($env:GIT_REMOTE) { $env:GIT_REMOTE } else { "origin" }
git remote get-url $remote *> $null
if ($LASTEXITCODE -ne 0) { Die "Git remote does not exist: $remote" }

& "$PSScriptRoot\check.ps1" -Release
if ($LASTEXITCODE -ne 0) { Die "Release checks failed" }
Require-CleanWorktree

Write-Log "Ready to push"
$lastCommit = (git log -1 --format="%H %s")
Write-Host "Remote: $remote"
Write-Host "Branch: $branch"
Write-Host "Commit: $lastCommit"

if (-not $Yes) {
    $answer = Read-Host "Push this commit? [y/N]"
    if ($answer -notmatch '^(y|yes)$') {
        Die "Push cancelled."
    }
}

git push $remote "HEAD:refs/heads/$branch"
if ($LASTEXITCODE -ne 0) { Die "git push failed" }
Write-Log "Push completed"
