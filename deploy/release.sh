#!/usr/bin/env bash
# Runs on the server (as root) to install an uploaded release.
# Called by deploy.ps1:   bash /tmp/release.sh /tmp/portfolio-release.tgz
set -euo pipefail

TGZ="${1:?release tarball}"
STAGE="$(mktemp -d)"
tar -xzf "$TGZ" -C "$STAGE"

echo "==> site"
rsync -a --delete "$STAGE/site/" /opt/portfolio/site/ 2>/dev/null || {
  rm -rf /opt/portfolio/site && mkdir -p /opt/portfolio/site && cp -a "$STAGE/site/." /opt/portfolio/site/
}

echo "==> backend"
# keep the venv between releases; replace the code
find /opt/portfolio/backend -mindepth 1 -maxdepth 1 ! -name .venv -exec rm -rf {} +
cp -a "$STAGE/backend/." /opt/portfolio/backend/
[ -d /opt/portfolio/backend/.venv ] || python3 -m venv /opt/portfolio/backend/.venv
/opt/portfolio/backend/.venv/bin/pip install --quiet --upgrade pip
/opt/portfolio/backend/.venv/bin/pip install --quiet -r /opt/portfolio/backend/requirements.txt

echo "==> garage data"
# first deploy only: start from your local garage.json (your logs + reviews).
# after that the server copy is the live one and is never overwritten.
if [ ! -f /var/lib/portfolio/garage.json ] && [ -f "$STAGE/garage.seed.json" ]; then
  cp "$STAGE/garage.seed.json" /var/lib/portfolio/garage.json
  echo "    seeded from your local garage.json"
fi

chown -R portfolio:portfolio /opt/portfolio /var/lib/portfolio
# releases are packed on Windows, which can leave files writable by every user
chmod -R go-w /opt/portfolio/site /opt/portfolio/backend
systemctl restart portfolio-api
sleep 2
if curl -fsS http://127.0.0.1:8001/api/health >/dev/null; then echo "==> API healthy"; else
  echo "!! API did not start — see: journalctl -u portfolio-api -n 50"; exit 1; fi

rm -rf "$STAGE" "$TGZ"
echo "Release installed."
