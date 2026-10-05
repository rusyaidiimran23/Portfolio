<#
Turn on the contact form's email: saves your Gmail App Password on the server
and sends you a test email.

  .\deploy\set-email.ps1 -Server root@165.22.61.25 -Gmail you@gmail.com

Get the App Password first: Google Account > Security > 2-Step Verification (must be on)
> App passwords > create one called "Portfolio". It's 16 letters.
The password is typed here hidden, sent over SSH, and only stored in /etc/portfolio.env
on the server - never in this repo.
#>
param(
  [Parameter(Mandatory)] [string] $Server,
  [Parameter(Mandatory)] [string] $Gmail,
  [string] $SendTo = ''   # optional: deliver messages to a different address
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$secure = Read-Host 'Gmail App Password (16 letters, hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (($pw -replace '\s', '').Length -ne 16) { throw 'An App Password is 16 letters - check it and run again.' }

Write-Host '==> uploading helper (enter the server password if asked)' -ForegroundColor Cyan
scp "$root\deploy\set-email.sh" "${Server}:/tmp/set-email.sh"
Write-Host '==> saving settings + sending a test email (server password again)' -ForegroundColor Cyan
"$Gmail`n$pw`n$SendTo`n" | ssh $Server "bash /tmp/set-email.sh; rm -f /tmp/set-email.sh"
$pw = $null
