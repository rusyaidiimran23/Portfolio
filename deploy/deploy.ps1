<#
Build the portfolio on this PC and ship it to the VPS.

First time (fresh server):
  .\deploy\deploy.ps1 -Server root@203.0.113.10 -Site rusyaidi.dev -Setup

Every update after that:
  .\deploy\deploy.ps1 -Server root@203.0.113.10

-Site is your domain (HTTPS automatic once its DNS points at the server),
or the server's IP if you don't have a domain yet.
Run .\update-photos.ps1 first if you changed photos.
#>
param(
  [Parameter(Mandatory)] [string] $Server,
  [string] $Site,
  [switch] $Setup,
  [string] $GaragePassword = ''
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $env:TEMP 'portfolio-release'

if ($Setup) {
  if (-not $Site) { throw 'First-time setup needs -Site (your domain, or the server IP).' }
  Write-Host '==> one-time server setup' -ForegroundColor Cyan
  scp "$root\deploy\setup.sh" "${Server}:/tmp/setup.sh"
  ssh $Server "bash /tmp/setup.sh '$Site' '$GaragePassword'"
  if ($LASTEXITCODE) { throw 'Server setup failed.' }
}

Write-Host '==> building the site' -ForegroundColor Cyan
Push-Location "$root\port_frontend"
# production builds call /api/... on their own domain (see src/lib/api.ts)
npm run build
$code = $LASTEXITCODE
Pop-Location
if ($code) { throw 'Build failed.' }
if (Select-String -Path "$root\port_frontend\dist\_astro\*.js" -Pattern 'localhost:8001' -Quiet) {
  throw 'Build still points at localhost:8001 — aborting.'
}

Write-Host '==> packing release' -ForegroundColor Cyan
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory "$work\site", "$work\backend\app" | Out-Null
Copy-Item "$root\port_frontend\dist\*" "$work\site" -Recurse
Copy-Item "$root\port_backend\requirements.txt" "$work\backend"
Get-ChildItem "$root\port_backend\app\*.py" | Copy-Item -Destination "$work\backend\app"
$garage = "$root\port_backend\app\garage.json"
if (Test-Path $garage) { Copy-Item $garage "$work\garage.seed.json" }   # only used on the very first deploy
$tgz = Join-Path $env:TEMP 'portfolio-release.tgz'
tar -czf $tgz -C $work .

Write-Host '==> uploading' -ForegroundColor Cyan
scp $tgz "$root\deploy\release.sh" "${Server}:/tmp/"
ssh $Server 'bash /tmp/release.sh /tmp/portfolio-release.tgz'
if ($LASTEXITCODE) { throw 'Release install failed on the server.' }

Remove-Item $work -Recurse -Force; Remove-Item $tgz -Force
Write-Host "`nDeployed. Open: $(if ($Site) { "https://$Site" } else { 'your site' })" -ForegroundColor Green
