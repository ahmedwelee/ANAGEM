#!/usr/bin/env bash
# Runs ANAGEM on a SMALL server (AlmaLinux / Oracle Linux / RHEL 9, about 1 GB of memory) without Docker.
# The database is on Neon, so the server only runs the backend (Java), the website (Node) and Caddy (HTTPS).
# The built files come from a GitHub release (built on a developer machine: the server is too small to build them).
#   curl -fsSL https://raw.githubusercontent.com/ahmedwelee/ANAGEM/main/deploy/small-server/setup.sh -o setup.sh && sudo bash setup.sh
# Run it again to update to the newest release. Secrets are typed in, never stored in the repository.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash setup.sh"; exit 1; }
REPO="ahmedwelee/ANAGEM"; TAG="${TAG:-latest}"
APP=/opt/anagem; ENVF=/etc/anagem.env
case "$(uname -m)" in x86_64) NODE_ARCH=x64; CADDY_ARCH=amd64;; aarch64) NODE_ARCH=arm64; CADDY_ARCH=arm64;; *) echo "Unsupported CPU"; exit 1;; esac

echo "== 1/6 swap (the server has little memory)"
if ! swapon --show | grep -q .; then
  fallocate -l 3G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 2/6 Java 17 and Node 24"
dnf install -y java-17-openjdk-headless curl tar xz >/dev/null
if [ ! -x /opt/node/bin/node ]; then
  F=$(curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | grep -o "node-v[0-9.]*-linux-$NODE_ARCH.tar.xz" | head -1)
  mkdir -p /opt/node && curl -fsSL "https://nodejs.org/dist/latest-v24.x/$F" | tar -xJ -C /opt/node --strip-components=1
fi

echo "== 3/6 Caddy (HTTPS)"
if [ ! -x /usr/local/bin/caddy ]; then
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=$CADDY_ARCH" -o /usr/local/bin/caddy && chmod +x /usr/local/bin/caddy
  setcap cap_net_bind_service=+ep /usr/local/bin/caddy
fi
id anagem >/dev/null 2>&1 || useradd --system --home-dir /var/lib/anagem --create-home --shell /sbin/nologin anagem

echo "== 4/6 the application files (release: $TAG)"
mkdir -p "$APP/web" /var/lib/anagem/storage && chown -R anagem /var/lib/anagem
BASE="https://github.com/$REPO/releases/$([ "$TAG" = latest ] && echo latest/download || echo download/$TAG)"
curl -fsSL "$BASE/anagem-api.jar" -o "$APP/anagem-api.jar"
rm -rf "$APP/web"/* && curl -fsSL "$BASE/anagem-web.tar.gz" | tar -xz -C "$APP/web"
chown -R anagem "$APP"

echo "== 5/6 settings (typed here, kept in $ENVF, readable only by root)"
if [ ! -f "$ENVF" ]; then
  ask() { local v; read -r -p "$1" v < /dev/tty; echo "$v"; }
  asks() { local v; read -r -s -p "$1" v < /dev/tty; echo >&2; echo "$v"; }
  DOMAIN=$(ask "Domain (e.g. anagem-demo.duckdns.org, empty = plain http on the IP): ")
  DB_URL=$(ask "Neon DB_URL (jdbc:postgresql://HOST/neondb?sslmode=require): ")
  DB_USER=$(ask "Neon user: ")
  DB_PASSWORD=$(asks "Neon password (hidden): ")
  ADMIN_PASSWORD=$(asks "Choose the admin password, 12+ characters (hidden): ")
  [ -n "$DOMAIN" ] && BASE_URL="https://$DOMAIN" || BASE_URL="http://$(curl -s ifconfig.me)"
  umask 077
  cat > "$ENVF" <<ENV
DOMAIN=$DOMAIN
DB_URL=$DB_URL
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
BOOTSTRAP_ADMIN_EMAIL=admin@anagem.local
BOOTSTRAP_ADMIN_PASSWORD=$ADMIN_PASSWORD
SPRING_PROFILES_ACTIVE=dev
PUBLIC_BASE_URL=$BASE_URL
CORS_ALLOWED_ORIGINS=$BASE_URL
STORAGE_DIR=/var/lib/anagem/storage
SERVER_PORT=8080
PORT=4000
API_ORIGIN=http://127.0.0.1:8080
PROXY_API=true
ALLOWED_HOSTS=${DOMAIN:-*},localhost,127.0.0.1
ENV
fi
. "$ENVF"
if [ -n "$DOMAIN" ]; then printf '%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:4000\n}\n' "$DOMAIN" > /etc/Caddyfile
else printf ':80 {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:4000\n}\n' > /etc/Caddyfile; fi

echo "== 6/6 services"
cat > /etc/systemd/system/anagem-api.service <<UNIT
[Unit]
Description=ANAGEM backend
After=network-online.target
[Service]
User=anagem
EnvironmentFile=$ENVF
ExecStart=/usr/bin/java -Xmx300m -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -jar $APP/anagem-api.jar
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/anagem-web.service <<UNIT
[Unit]
Description=ANAGEM website
After=anagem-api.service
[Service]
User=anagem
EnvironmentFile=$ENVF
WorkingDirectory=$APP/web
ExecStart=/opt/node/bin/node --max-old-space-size=160 $APP/web/server/server.mjs
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/anagem-caddy.service <<UNIT
[Unit]
Description=ANAGEM HTTPS proxy
After=network-online.target
[Service]
User=anagem
Environment=XDG_DATA_HOME=/var/lib/anagem XDG_CONFIG_HOME=/var/lib/anagem
ExecStart=/usr/local/bin/caddy run --config /etc/Caddyfile --adapter caddyfile
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1 && { firewall-cmd --permanent --add-service=http --add-service=https; firewall-cmd --reload; } || true
systemctl daemon-reload
systemctl enable anagem-api anagem-web anagem-caddy >/dev/null 2>&1
systemctl restart anagem-api anagem-web anagem-caddy
echo "Started. The backend needs a few minutes to start on a small server."
echo "Watch it:  journalctl -u anagem-api -f      (Ctrl+C to stop)"
echo "Site: ${PUBLIC_BASE_URL}   Admin: admin@anagem.local"
