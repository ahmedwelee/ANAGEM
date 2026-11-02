# ANAGEM — Association Nationale des Géographes Marocains

Multilingual institutional website and content management system, in **Arabic (right-to-left, the default), French and English**.

| Part | What it is | Where |
|---|---|---|
| Public website | Angular server-side rendered site: home, association, news, events (colloques), publications and the journal, resources, members, contact, search. Localized URLs `/fr`, `/ar`, `/en`, per-page SEO, `sitemap.xml`, `robots.txt` | `frontend/` |
| Admin dashboard | Same Angular app under `/admin`: news, publications, events, resources, media library, categories, partners, homepage and static pages, settings, users and roles, audit log, contact messages | `frontend/` |
| API | Spring Boot 3 / Java 17, PostgreSQL, Flyway, JWT, OpenAPI | `backend/` |
| Edge | nginx: `/api` to the API, everything else to the web server | `deploy/nginx/` |
| End-to-end tests | Playwright driving a real browser against the real backend, database and server-rendered site | `e2e/` |
| Design prototype | The static Phase 2 homepage the Angular design was ported from (kept for reference) | `web/` |

## Run everything with Docker

```bash
cp .env.example .env
# edit .env: set DB_PASSWORD, JWT_SECRET (openssl rand -base64 48), BOOTSTRAP_ADMIN_EMAIL and PUBLIC_BASE_URL
docker compose up -d --build
```

- Public site: http://localhost (port `HTTP_PORT`), admin: `/admin`.
- The first start with an empty database creates one SUPER_ADMIN from `BOOTSTRAP_ADMIN_EMAIL`. If `BOOTSTRAP_ADMIN_PASSWORD` is empty a random password is printed once: `docker compose logs backend | grep -i password`. Sign in and change it.
- Data lives in two volumes: `pgdata` (database) and `media` (uploaded files). Back both up (see `docs/deployment.md`).
- A new installation contains only what the source documents support: the homepage sections and the About, Members, Legal and Privacy pages (summarised from the statutes; FR/EN are working translations to validate), the categories, the roles, and the Kénitra national meeting from the programme. **No news or publications are invented**; everything else is created in the admin.

## Develop

| Task | Command |
|---|---|
| Database only | `docker compose up -d db` |
| Backend (hot restart, sample content, Swagger) | `cd backend && SPRING_PROFILES_ACTIVE=dev DB_PASSWORD=<pw> ./mvnw spring-boot:run` |
| Frontend (public + admin, SSR, proxies `/api`) | `cd frontend && API_TARGET=http://127.0.0.1:8080 API_ORIGIN=http://127.0.0.1:8080 PUBLIC_BASE_URL=http://localhost:4300 npm start` → http://localhost:4300 |
| **Every test suite** (backend, frontend, browser) with one summary | `scripts/test-all.sh` (`--fast` skips the browser tests) |
| Backend tests (178, embedded PostgreSQL, no Docker) | `cd backend && ./mvnw verify` |
| Frontend tests (353, Vitest) | `cd frontend && npx ng test --no-watch` |
| End-to-end browser tests (72, Playwright + Chrome, no Docker) | `cd frontend && npm run build && cd ../e2e && npm test` |
| Production build | `cd frontend && npm run build` |

The `dev` profile creates `admin@anagem.local` (random password in the log) and loads **placeholder** content tagged `sample`. Never use it in production.

Frontend notes (`frontend/README.md`): translations live in `frontend/i18n-src/*.json` (one file per area, three languages side by side) and are merged into `public/i18n/` by `npm run i18n`; icons come from Lucide via `npm run icons`. Colours, fonts and motion are design tokens in `frontend/src/styles/tokens.css`.

## Documents

| Document | Content |
|---|---|
| `docs/requirements/01-requirements-and-open-questions.md` | What the statutes and programme say, which content is sample, **questions ANAGEM must answer** |
| `docs/architecture/01-architecture-and-roadmap.md` | Stack, how the pieces fit, phase status, known gaps |
| `docs/architecture/02-api-reference.md` | Every REST endpoint |
| `docs/architecture/03-database-and-permissions.md` | Tables, roles, permission matrix, security notes |
| `docs/deployment.md` | Environment variables, production checklist, TLS, backup and restore, troubleshooting |
| `docs/testing.md` | The three test levels, what the browser tests prove, how to write tests, bugs the tests found, what is not covered |
| `docs/qa-checklist.md` | Automated test coverage and the manual QA matrix (languages × devices × roles) |
| `docs/references/` | Original statutes, conference programme, reference screenshot |

## Before launch (needs ANAGEM)

1. Replace sample content and fill **Settings** (site name, tagline, e-mail, phone, postal address, social links) — empty values are hidden, not faked.
2. Write **Legal notices** and **Data protection** in *Homepage and pages* (the pages exist but say "content coming soon" until then).
3. Upload the statutes PDF to the media library and select it on the *About* page.
4. Answer the open questions in `docs/requirements` (official map, membership workflow and fees, partners and logos, English name, office holders).
5. Put TLS in front of the edge (`docs/deployment.md`), set `PUBLIC_BASE_URL` and `ALLOWED_HOSTS` to the real domain, keep `SPRING_PROFILES_ACTIVE` and `SPRINGDOC_ENABLED` off.
