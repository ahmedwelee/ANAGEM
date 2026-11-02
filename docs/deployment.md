# ANAGEM — Deployment guide

## What runs

```
visitors ──► edge (nginx :80) ──► /api/*  ──► backend (Spring Boot :8080) ──► db (PostgreSQL)  + media volume
                              └─► /*      ──► web (Angular SSR, Node :4000) ──► backend (server-side rendering calls /api)
```

| Service | Image | Notes |
|---|---|---|
| `db` | `postgres:16-alpine` | Volume `pgdata`. Port published on loopback only |
| `backend` | built from `backend/` (Temurin 17 JRE, non-root) | Flyway runs migrations at start. Volume `media` holds uploads. Health: `/actuator/health` |
| `web` | built from `frontend/` (Node 24, non-root) | Renders public pages on the server (real HTML for search engines and link previews), serves the admin as a client app, `/robots.txt`, `/sitemap.xml`, `/` → the visitor's last language, else `/ar` |
| `edge` | `nginx:1.27-alpine` | Only `/api/` reaches the backend, so `/actuator`, Swagger and `/v3/api-docs` are not public |

## Environment variables (`.env` next to `docker-compose.yml`)

| Variable | Required | Meaning |
|---|---|---|
| `DB_PASSWORD` | yes | PostgreSQL password (the volume keeps the first one: change it with `ALTER USER` if you change it later) |
| `JWT_SECRET` | yes | ≥ 32 random characters. Changing it signs everyone out |
| `PUBLIC_BASE_URL` | yes in production | `https://anagem.ma` — canonical links, Open Graph, `sitemap.xml`, `robots.txt` |
| `ALLOWED_HOSTS` | yes in production | Domains the web server accepts, comma-separated: `anagem.ma,www.anagem.ma`. Other `Host` headers get an error |
| `BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` | first start | Creates the first SUPER_ADMIN only while the user table is empty. Empty password → random one in the backend log |
| `CORS_ALLOWED_ORIGINS` | no | Defaults to `PUBLIC_BASE_URL`. The site is same-origin through the edge, so you rarely need more |
| `SPRINGDOC_ENABLED` | no | `true` serves Swagger UI on the backend port (loopback only). Keep `false` |
| `SPRING_PROFILES_ACTIVE` | no | Empty in production. `dev` = sample content + Swagger + weak defaults |
| `HTTP_PORT`, `DB_PORT`, `BACKEND_PORT` | no | Host ports (edge 80, db 5432, backend 8080 on loopback) |

Other backend settings (token lifetime, upload limits, rate limits, storage directory) are in `backend/src/main/resources/application.yml` and can be overridden with environment variables.

## Production checklist

1. **Secrets**: strong `DB_PASSWORD` and `JWT_SECRET`; `.env` is git-ignored — keep it that way.
2. **Domain and TLS**: terminate HTTPS in front of the edge (hosting load balancer, Caddy, Traefik, Cloudflare). The edge trusts `X-Forwarded-Proto`/`-For`, so rate limiting and the audit log see the real visitor address. If nginx itself must serve TLS, mount certificates and use:
   ```nginx
   server { listen 80; server_name anagem.ma www.anagem.ma; return 301 https://anagem.ma$request_uri; }
   server {
       listen 443 ssl;  http2 on;
       server_name anagem.ma;
       ssl_certificate     /etc/nginx/certs/fullchain.pem;
       ssl_certificate_key /etc/nginx/certs/privkey.pem;
       add_header Strict-Transport-Security "max-age=31536000" always;
       # ...then the same locations and proxy headers as deploy/nginx/default.conf
   }
   ```
3. `PUBLIC_BASE_URL=https://…` and `ALLOWED_HOSTS` set to the real domains **before** the first crawl, otherwise canonical links point to the wrong address.
4. Sign in as the bootstrap admin, **change the password**, create named accounts (Users → roles), then disable or delete the bootstrap account if it is not a person.
5. Settings: site name, tagline, e-mail, phone, address, social links. Empty settings are not displayed.
6. Content: replace placeholders, write *Legal notices* and *Data protection*, upload the statutes PDF and attach it to the About page.
7. Submit `https://anagem.ma/sitemap.xml` to Google Search Console / Bing Webmaster Tools.
8. Backups (below) scheduled and a restore tried once.

## Backups

```bash
# database (writes a compressed dump on the host)
docker compose exec -T db pg_dump -U anagem -Fc anagem > anagem-$(date +%F).dump

# uploaded files
docker run --rm -v <project>_media:/data -v "$PWD":/backup alpine tar czf /backup/media-$(date +%F).tgz -C /data .
```

Restore into an empty installation: start only `db`, then `docker compose exec -T db pg_restore -U anagem -d anagem --clean --if-exists < anagem-YYYY-MM-DD.dump`, unpack the media archive into the `media` volume, then start everything. (`<project>` is the compose project name, see `docker volume ls`.)

## Updating

```bash
git pull
docker compose up -d --build        # rebuilds changed images; Flyway applies new migrations on backend start
```

Migrations are forward-only. Back up the database first. Roll back by restoring the dump and the previous image.

## Operations notes

- **One backend instance.** Rate limiting and login lockout counters live in memory. Running several backend replicas multiplies the limits; use one, or move the counters to Redis first.
- **Uploads** are re-encoded and size-limited by the backend (images 8 MB, PDFs 50 MB); nginx allows up to 64 MB per request.
- **Logs**: `docker compose logs -f backend web edge`. The audit log (who changed what) is also in the admin under *Audit*.
- **Health**: `docker compose ps` shows `healthy` for `db`, `backend` and `web`.
- **Caching**: hashed JS/CSS are cached for a year; dictionaries and icons revalidate hourly; media are served with ETag and a 7-day cache.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Visitors get "400 Bad Request", `web` logs `Header "host" with value "…" is not allowed` | The domain is missing in `ALLOWED_HOSTS` (restart `web` after editing `.env`) |
| Pages show "Impossible de charger cette page" and `web` logs `[ssr] API call failed` | The web server cannot reach the API: `docker compose ps` (backend must be `healthy`); `API_ORIGIN` is `http://backend:8080` inside the compose network |
| `canonical`/`og:url` show `localhost` | `PUBLIC_BASE_URL` not set in `.env` (restart `web` and `backend` after changing it) |
| Cannot sign in, backend log says `JWT_SECRET` too short | Use ≥ 32 characters |
| Forgot the admin password | Another SUPER_ADMIN resets it (Users → reset password). If none: stop `backend`, delete the user row in `users`, start with `BOOTSTRAP_ADMIN_*` set |
| Colima / Docker Desktop on macOS: published port unreachable from the host | Recreate the VM (`colima stop && colima start`) or publish another port with `HTTP_PORT` |
| `port is already allocated` | Change `HTTP_PORT`, `DB_PORT` or `BACKEND_PORT` in `.env` |
