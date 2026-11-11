#!/usr/bin/env bash
# One-time setup of an Ubuntu server (Oracle Cloud Always Free or any VPS): Docker, the code, secrets, HTTPS, start.
#   curl -fsSL https://raw.githubusercontent.com/ahmedwelee/ANAGEM/main/deploy/oracle-setup.sh | bash -s -- your-name.duckdns.org
set -euo pipefail
DOMAIN="${1:?Usage: oracle-setup.sh <domain>  (e.g. anagem-demo.duckdns.org)}"

sudo apt-get update -y && sudo apt-get install -y ca-certificates curl git
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" || true

# Ubuntu images on Oracle block most ports with iptables: open 80 and 443.
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo sh -c 'command -v netfilter-persistent >/dev/null && netfilter-persistent save || true'

[ -d ANAGEM ] || git clone https://github.com/ahmedwelee/ANAGEM.git
cd ANAGEM && git pull --ff-only

if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  cat > .env <<ENV
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
PUBLIC_BASE_URL=https://$DOMAIN
ALLOWED_HOSTS=$DOMAIN,localhost,127.0.0.1
SITE_DOMAIN=$DOMAIN
BOOTSTRAP_ADMIN_EMAIL=admin@anagem.local
BOOTSTRAP_ADMIN_PASSWORD=$ADMIN_PASS
# 'dev' loads the placeholder demo content (news, events...). Leave empty for a clean production start.
SPRING_PROFILES_ACTIVE=dev
ENV
  chmod 600 .env
  echo "Admin login: admin@anagem.local / $ADMIN_PASS   (also in ANAGEM/.env)"
fi

sudo docker compose -f docker-compose.yml -f deploy/https/docker-compose.https.yml up -d --build
echo "Done. Open https://$DOMAIN in a minute or two (the first build takes several minutes)."
