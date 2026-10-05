#!/usr/bin/env bash
# Runs on the server (as root). Called by set-email.ps1, which pipes in three
# lines on stdin — so the password never appears on a command line:
#   1) Gmail address   2) Gmail App Password   3) where messages go (blank = same Gmail)
set -euo pipefail

IFS= read -r SMTP_USER_IN
IFS= read -r SMTP_PASS_IN
IFS= read -r CONTACT_TO_IN || true
export SMTP_USER_IN SMTP_PASS_IN CONTACT_TO_IN

# rewrite just those keys in /etc/portfolio.env (env vars, not argv, so nothing shows in `ps`)
python3 - <<'PY'
import os, re
path = "/etc/portfolio.env"
clean = lambda k: os.environ[k].replace("\r", "").strip()
vals = {
    "SMTP_HOST": "smtp.gmail.com",
    "SMTP_PORT": "587",
    "SMTP_USER": clean("SMTP_USER_IN"),
    "SMTP_PASSWORD": clean("SMTP_PASS_IN").replace(" ", ""),  # Google shows it as 4 groups of 4
    "CONTACT_TO": clean("CONTACT_TO_IN"),
}
text = open(path).read()
for k, v in vals.items():
    line = f"{k}={v}"
    text, n = re.subn(rf"^{k}=.*$", line, text, flags=re.M)
    if not n:
        text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
os.chmod(path, 0o600)
PY

systemctl restart portfolio-api
sleep 2
echo "==> sending a test email…"
cd /opt/portfolio/backend
set -a; . /etc/portfolio.env; set +a
if .venv/bin/python -c "import os; from app import mailer; mailer.send_contact('Setup test', os.environ['SMTP_USER'], 'Your portfolio contact form is wired up. Hit Reply on a real message to answer the sender.', 'server')"; then
  echo "==> sent. Check ${CONTACT_TO:-$SMTP_USER} (and Spam, the first time)."
else
  echo "!! Gmail refused it. Usually: 2-Step Verification is off, or the App Password was mistyped. Run this script again."
  exit 1
fi
