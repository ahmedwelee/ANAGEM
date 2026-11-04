# ANAGEM — Architecture and roadmap

## Target stack (from the brief)

- **Frontend**: Angular (standalone components, Router, Reactive Forms), Tailwind or the existing token CSS, Transloco for i18n, a rich-text editor with RTL support, Chart.js/ECharts for the dashboard.
- **Backend**: Java 17, Spring Boot, Spring Security (JWT + BCrypt), Spring Data JPA, Bean Validation, OpenAPI, Flyway.
- **Database**: PostgreSQL. **Storage**: file-storage interface (local now, S3 later).
- **Delivery**: Docker + docker-compose, seed data, README.

Local tooling: Node/npm, Java 17, Docker (Colima). Build the backend with `backend/mvnw` or through Docker.

## Why Phase 2 is a static prototype

The homepage is built first as plain HTML/CSS/JS in `web/` so the look, motion and RTL behaviour can be validated against the reference screenshot before the Angular app exists. It is structured to port 1:1:

| Prototype | Becomes |
|---|---|
| `web/css/tokens.css` | Global design tokens (kept as CSS variables) |
| `web/partials/*.html` (one per section) | One Angular standalone component per section |
| `web/i18n/{fr,ar,en}.json` (flat keys) | Transloco files `assets/i18n/*.json` — same keys |
| `data-i18n` attributes | `transloco` pipe / directive |
| `js/main.js` date/status logic | Pure functions in a shared util + `EventStatusPipe` |
| `js/map.js` | `MoroccoMapComponent` (outline loaded from CMS/settings) |
| Hard-coded French in HTML, sample news/events | Data from `/api/public/*` (nothing hard-coded in production) |

Event/colloque status (upcoming / ongoing / past) is computed from dates, never stored, so the "Prochain colloque" banner turns into "Dernier colloque" automatically.

## Data model (summary)

Content entities each have: id, created/updated timestamps, publication status, author. Translations are separate rows keyed by `(entity_id, locale)` so FR/AR/EN can be partially filled and a missing-translation report can be produced.

`User`, `Role`, `Permission` · `Category` (one table, typed NEWS/PUBLICATION/EVENT/RESOURCE) + translations · `News` + translations + tags · `Publication` (journal issues, books, proceedings via `kind`) + translations · `Event` + translations · `Resource` + translations · `MediaFile` + translations · `Partner` · `HomepageSection` · `WebsiteSetting` · `AuditLog` · `ContactMessage`. `Member` / `MembershipApplication` are deferred until ANAGEM confirms the workflow (see open questions). Full detail: `03-database-and-permissions.md`.

## Frontend architecture (`frontend/`)

One Angular 22 application (standalone components, signals, zoneless, Tailwind v4 on the shared design tokens, Transloco, Reactive Forms, TipTap rich-text editor, Chart.js, Lucide icons) serves both the public site and the admin.

| Concern | How |
|---|---|
| Routing and languages | Public pages live under `/:lang` with `lang` ∈ `fr, ar, en` (a custom URL matcher); **Arabic is the default language**: `/` redirects to the language the visitor picked last (cookie), otherwise to `/ar`, whatever the browser language is. The same constant (`DEFAULT_LANG`) drives the admin start-up language, `x-default` in hreflang and the sitemap. Admin lives under `/admin` and keeps its own saved language |
| Rendering | `app.routes.server.ts`: public routes are rendered **on the server per request** (real HTML, meta tags and HTTP status for crawlers and link previews); `/admin/**` is client-rendered. The browser then hydrates and reuses the data the server fetched (HTTP transfer cache), so the first view makes no duplicate API calls |
| API access | `core/api/*` typed clients. On the server a small `HttpBackend` adds the backend origin (`API_ORIGIN`); in the browser calls stay same-origin (`/api`, proxied by nginx or the dev server) |
| SEO | `SeoService` sets title, description, canonical, hreflang alternates, Open Graph/Twitter and JSON-LD on every page; `noindex` pages (404, search, admin) get no canonical. `server.ts` serves `robots.txt` and `sitemap.xml` (static pages + published content from `/api/public/sitemap`, three languages with alternates). Unknown content URLs return a real 404 |
| i18n | `i18n-src/*.json` (three languages per file) → `public/i18n/{fr,ar,en}.json`. `npm run i18n` fails when a key is missing in a language; `scripts/check-i18n-usage.mjs` fails when code uses an unknown key. CMS content is localized by the API (requested language, then fr, ar, en, with a `fallback` flag the page shows) |
| RTL | `<html dir>` follows the language; layouts use logical Tailwind utilities (`ps-`, `start-`, `rtl:`) and the Cairo font for Arabic |
| Admin | Lazy feature routes behind `authGuard` + `permissionGuard`; menus and buttons hide what the user's permissions refuse (the API enforces the same rules); forms use one translation group per language and refuse to save a language that has text but no title |
| Motion | CSS keyframes ported from the prototype (hero word reveal, Ken Burns, map drawing, scroll reveal); all switched off under `prefers-reduced-motion` |

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 Analysis | Read statutes + programme, requirements, open questions | **Done** (`docs/requirements`) |
| 2 UI design | Tokens, header/footer, homepage, FR/AR/EN + RTL, animation | **Done** as static prototype in `web/` |
| 3 Backend | Spring Boot, PostgreSQL, Flyway, entities, REST, JWT, file storage | **Done** (`backend/`, 178 tests) |
| 4 Admin dashboard | Dashboard, news/publications/events/resources/media/categories/partners/homepage and pages/settings/users/roles/audit/messages | **Done** (`frontend/src/app/features/admin`) |
| 5 Public site | Angular SSR, real APIs, all pages, search, SEO, sitemap | **Done** (`frontend/src/app/features/public`) |
| 6 Testing | Backend, frontend and real-browser end-to-end tests, i18n/RTL/responsive checks | **Done** (`docs/testing.md`), with a manual matrix left for humans (`docs/qa-checklist.md`) |
| 7 Docs & delivery | Docker (db, backend, web, edge), README, API/DB/permissions/deployment docs | **Done** |

## Known gaps

- **Members**: no member directory, online membership application or member login. The statutes leave fees and validation to ANAGEM, so the Members page explains categories and how to apply by contact (see open questions).
- **Backend**: no refresh tokens or password-reset e-mail (an admin resets passwords); rate limiting and lockout counters are in memory (run one backend instance); uploads are not virus-scanned; contact messages are stored, not e-mailed.
- **Search** is a substring match on titles (plus summary for news and location for events) across news, events and publications: no ranking and no full-text search over article bodies.
- **Map** in the hero uses real open boundary data (Natural Earth, thinned; `tools/morocco-map`), not ANAGEM's official cartography; photos on the prototype are crops of the programme flyer.
- **Not verified**: Safari/Firefox, screen reader, Lighthouse scores, load behaviour (see `docs/qa-checklist.md`).
