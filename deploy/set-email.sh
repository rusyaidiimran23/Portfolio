#!/usr/bin/env bash
# Runs on the server (as root). Called by set-email.ps1, which pipes in two
# lines on stdin - so the key never appears on a command line:
#   1) Resend API key   2) where messages go (the address you signed up to Resend with)
set -euo pipefail

if ! grep -q RESEND_API_KEY /opt/portfolio/backend/app/mailer.py 2>/dev/null; then
  echo "!! The server is running an older version. Deploy first (.\\deploy\\deploy.ps1), then run this again."
  exit 1
fi

IFS= read -r RESEND_IN
IFS= read -r TO_IN || true
export RESEND_IN TO_IN

# rewrite just those keys in /etc/portfolio.env (env vars, not argv, so nothing shows in `ps`)
python3 - <<'PY'
import os, re
path = "/etc/portfolio.env"
clean = lambda k: os.environ[k].replace("\r", "").strip()
vals = {
    "RESEND_API_KEY": clean("RESEND_IN"),
    "CONTACT_TO": clean("TO_IN"),
    # outgoing SMTP is blocked on this host: drop any saved Gmail login
    "SMTP_USER": "",
    "SMTP_PASSWORD": "",
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
echo "==> sending a test email..."
cd /opt/portfolio/backend
set -a; . /etc/portfolio.env; set +a
if .venv/bin/python -c "import os; from app import mailer; mailer.send_contact('Setup test', os.environ['CONTACT_TO'], 'Your portfolio contact form is wired up. Hit Reply on a real message to answer the sender.', 'server')"; then
  echo "==> sent. Check $CONTACT_TO (and Spam, the first time)."
else
  echo "!! Resend refused it - the reason is in the line above. Usual causes: the key was mistyped,"
  echo "   or CONTACT_TO isn't the email you signed up to Resend with."
  exit 1
fi
