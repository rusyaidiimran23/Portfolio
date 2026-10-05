#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 VPS for the portfolio.
# Run as root:   bash setup.sh <domain-or-ip> [garage-password]
#
#   <domain>  e.g. rusyaidi.dev  -> Caddy gets an HTTPS certificate automatically
#             (point the domain's A record at this server first)
#   <ip>      e.g. 203.0.113.10  -> plain HTTP until you add a domain
#
# Installs Caddy + Python, creates a 'portfolio' service user, writes
# /etc/portfolio.env (secrets), a systemd service for the API, and the Caddyfile.
# Safe to re-run: existing secrets are kept. Started on an IP? Re-run it with
# your domain later to switch over (HTTPS + www redirect).
set -euo pipefail

SITE="${1:?usage: bash setup.sh <domain-or-ip> [garage-password]}"
PASS="${2:-}"

echo "==> packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv curl debian-keyring debian-archive-keyring apt-transport-https gnupg ufw
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> user + folders"
id portfolio >/dev/null 2>&1 || useradd --system --home /opt/portfolio --shell /usr/sbin/nologin portfolio
mkdir -p /opt/portfolio/site /opt/portfolio/backend /var/lib/portfolio
chown -R portfolio:portfolio /opt/portfolio /var/lib/portfolio

echo "==> secrets (/etc/portfolio.env)"
if [ ! -f /etc/portfolio.env ]; then
  [ -n "$PASS" ] || PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)"
  cat > /etc/portfolio.env <<EOF
GARAGE_PASSWORD=${PASS}
GARAGE_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
GARAGE_FILE=/var/lib/portfolio/garage.json
ALLOWED_ORIGINS=https://${SITE},http://${SITE}

# Contact form email — fill these in, then: systemctl restart portfolio-api
# Gmail: SMTP_PASSWORD must be an App Password (Google account > Security >
# 2-Step Verification > App passwords), not your normal password.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
CONTACT_TO=
EOF
  chmod 600 /etc/portfolio.env
  NEWPASS=1
else
  echo "    kept existing /etc/portfolio.env"
fi

echo "==> API service"
cat > /etc/systemd/system/portfolio-api.service <<'EOF'
[Unit]
Description=Portfolio API (FastAPI)
After=network.target

[Service]
User=portfolio
WorkingDirectory=/opt/portfolio/backend
EnvironmentFile=/etc/portfolio.env
# one worker on purpose: garage.json is guarded by an in-process lock
ExecStart=/opt/portfolio/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable portfolio-api >/dev/null

echo "==> Caddy (site + /api proxy)"
cat > /etc/caddy/Caddyfile <<EOF
${SITE} {
	encode zstd gzip

	handle /api/* {
		reverse_proxy 127.0.0.1:8001
	}

	handle {
		root * /opt/portfolio/site
		try_files {path} {path}/ {path}/index.html
		file_server
	}

	header /_astro/* Cache-Control "public, max-age=31536000, immutable"
	header /work/photos.json Cache-Control "no-store"
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
}
EOF
# a real domain (not an IP) also gets www.<domain> -> <domain>
if [[ ! "$SITE" =~ ^[0-9.]+$ ]] && [[ "$SITE" != www.* ]]; then
  cat >> /etc/caddy/Caddyfile <<EOF

www.${SITE} {
	redir https://${SITE}{uri} permanent
}
EOF
fi
systemctl enable caddy >/dev/null
systemctl reload caddy || systemctl restart caddy

echo "==> firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80,443/tcp >/dev/null
ufw --force enable >/dev/null

echo
echo "Setup done. Now deploy the site from your PC (deploy.ps1)."
if [ "${NEWPASS:-}" = 1 ]; then
  echo
  echo "  Garage password: ${PASS}"
  echo "  (saved in /etc/portfolio.env — change it there, then: systemctl restart portfolio-api)"
  echo
  echo "  Contact form email is OFF until you fill in SMTP_USER / SMTP_PASSWORD in /etc/portfolio.env"
fi
