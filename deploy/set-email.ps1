<#
Turn on the contact form's email (via Resend - DigitalOcean blocks normal outgoing
mail on new droplets, Resend sends over HTTPS instead). Saves the key on the server
and sends you a test email.

  .\deploy\set-email.ps1 -Server root@165.22.61.25 -To you@gmail.com

-To must be the email address you signed up to resend.com with (free plan: it can
only deliver to that address, which is exactly what a contact form needs).
Get the key: resend.com > API Keys > Create API Key (Sending access). Starts with re_
The key is typed here hidden, sent over SSH, and only stored in /etc/portfolio.env
on the server - never in this repo.
#>
param(
  [Parameter(Mandatory)] [string] $Server,
  [Parameter(Mandatory)] [string] $To
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$secure = Read-Host 'Resend API key (starts with re_, hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (-not $key.StartsWith('re_')) { throw 'A Resend API key starts with re_ - copy it again and rerun.' }

Write-Host '==> uploading helper (enter the server password if asked)' -ForegroundColor Cyan
scp "$root\deploy\set-email.sh" "${Server}:/tmp/set-email.sh"
Write-Host '==> saving settings + sending a test email (server password again)' -ForegroundColor Cyan
"$key`n$To`n" | ssh $Server "bash /tmp/set-email.sh; rm -f /tmp/set-email.sh"
$key = $null
