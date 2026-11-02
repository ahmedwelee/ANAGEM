# ANAGEM CMS — API reference

Interactive docs (Swagger UI) are served at `/swagger-ui.html` when `SPRINGDOC_ENABLED=true` (always on in the `dev` profile, off by default elsewhere). OpenAPI JSON: `/v3/api-docs`.

## Conventions

- **Languages**: `fr`, `ar`, `en`. Public endpoints take `?lang=` (wins) or `Accept-Language`; default `ar` (the site's default language). If a text is missing in the requested language the API falls back (requested → ar → fr → en) and reports `locale` (language actually served) and `fallback: true`.
- **Auth**: `/api/admin/**` and `/api/auth/**` (except login) need `Authorization: Bearer <jwt>`. `/api/public/**` is open.
- **Pagination**: `?page=0&size=20` (size ≤ 100). Response: `{ content, page, size, totalElements, totalPages }`. Admin lists accept `sort=field,asc|desc` from a per-resource whitelist.
- **Errors** (every error, including 401/403/429): `{ timestamp, status, code, message, path, fieldErrors?: [{field, message}] }`. `code` is a stable key for the UI, e.g. `VALIDATION_FAILED`, `UNAUTHENTICATED`, `ACCESS_DENIED`, `INVALID_CREDENTIALS`, `PUBLISHED_CONTENT_LOCKED`, `PUBLISH_FORBIDDEN`, `SLUG_TAKEN`, `MEDIA_IN_USE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `RATE_LIMITED`, `CONCURRENT_MODIFICATION`.
- **Content status**: `DRAFT → PENDING_REVIEW → PUBLISHED | SCHEDULED | ARCHIVED`. Public visibility = status `PUBLISHED`/`SCHEDULED` **and** `publishedAt <= now` (so scheduled items go live by date, no job needed).
- **Translations** are objects keyed by language (`"translations": {"fr": {...}, "ar": {...}}`). Any subset may be sent; each language provided needs a title. Admin responses add `translationStatus` per language (`present`, `complete`, `missingFields`).
- **Rich text** (`content`, `description`) is sanitized server-side (allow-list: headings, lists, tables, links, images, quotes, `dir`/`lang`). Scripts, event handlers, iframes and `javascript:` URLs are removed.
- **Dates** are ISO-8601 UTC. Events also return `timezone: "Africa/Casablanca"` and a computed `timeStatus` (`UPCOMING | ONGOING | PAST`).
- **Files** are only ever referenced by media id; URLs look like `/api/public/media/{uuid}`. Storage paths are never exposed.

## Authentication

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{accessToken, tokenType, expiresAt, user}`. Rate-limited per IP; account locks 15 min after 5 failures; identical error for unknown email and wrong password |
| POST | `/api/auth/logout` | Revokes the token in use |
| GET | `/api/auth/me` | Current user + permissions |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword (≥12 chars)}`; revokes the current token |

## Public

All `lang` parameters accept `fr`, `ar`, `en`; responses carry `locale` (language actually used) and `fallback` (true when the requested language was missing). Responses are `Cache-Control: no-store` (Spring Security default); the web server re-uses them once when it hands a rendered page to the browser.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/public/homepage` | Everything the homepage needs, localized: CMS sections, 3 news, 4 events (upcoming first, then recently past), featured event, latest journal issue, partners, public settings |
| GET | `/api/public/settings` | Public site settings, localized |
| GET | `/api/public/pages/{slug}` | Static page content, localized (`about`, `members`, `legal`, `privacy`; any `PAGE_*` section edited under *Homepage and pages*). 404 when missing or disabled |
| GET | `/api/public/sitemap` | `{news, events, publications, resources: [{ref, updatedAt}]}` for published content only; the web server turns it into `sitemap.xml` |
| GET | `/api/public/news` | `q`, `category` (slug), `tag`, `page`, `size` |
| GET | `/api/public/news/featured` | `limit` |
| GET | `/api/public/news/{slug}` · `/{slug}/related` | Related = same category or shared tag |
| GET | `/api/public/publications` | `q` (title), `year`, `categoryId`, `kind` (`MAGAZINE_ISSUE`, `BOOK`, `PROCEEDINGS`, `REPORT`, `OTHER`) |
| GET | `/api/public/publications/years` · `/{id}` | Years that have published items; detail includes `pdf` and `pdfDownloadUrl` |
| GET | `/api/public/events` | `scope=UPCOMING|PAST|ALL`, `type`, `categoryId`, `q` |
| GET | `/api/public/events/upcoming` · `/{idOrSlug}` | |
| GET | `/api/public/resources` · `/{id}` | `q`, `kind`, `categoryId` |
| GET | `/api/public/partners` | |
| GET | `/api/public/categories?type=NEWS|PUBLICATION|EVENT|RESOURCE` | Active categories, localized |
| POST | `/api/public/contact` | `{name, email, subject?, message (10–5000), locale?}`; rate-limited; hidden `website` field is a bot trap |
| GET | `/api/public/media/{id}` · `/{id}/thumbnail` | `?download=true` forces download; ETag + 7-day cache |

## Admin (permission in brackets)

| Resource | Endpoints |
|---|---|
| News `[CONTENT_WRITE]` | `GET /api/admin/news`, `GET /{id}`, `GET /{id}/preview?lang=`, `POST`, `PUT /{id}`, `DELETE /{id}` `[CONTENT_DELETE]`, `PATCH /{id}/status` `{status, publishedAt?}`, `PATCH /{id}/publish` `[CONTENT_PUBLISH]` |
| Publications | same shape under `/api/admin/publications` (filters: `status`, `kind`, `q`, `year`) |
| Events | same shape under `/api/admin/events` (filters: `status`, `type`, `scope`, `q`) |
| Resources | `/api/admin/resources` (list/get/create/update/delete/status; publishing requires a file or an external link) |
| Categories `[CATEGORY_MANAGE]` | `GET/POST /api/admin/categories`, `PUT/DELETE /{id}` (delete refused while in use) |
| Partners `[PARTNER_MANAGE]` | `/api/admin/partners` CRUD |
| Media `[MEDIA_UPLOAD]` / `[MEDIA_DELETE]` | `POST /api/admin/media/upload` (multipart `file`), `GET` (`q`, `kind`), `GET /{id}`, `PUT /{id}` (alt text/description per language), `DELETE /{id}?force=` |
| Homepage `[HOMEPAGE_MANAGE]` | `GET /api/admin/homepage/sections`, `PUT /sections/{key}` `{enabled?, sortOrder?, content}` |
| Settings `[SETTINGS_MANAGE]` | `GET /api/admin/settings`, `PUT` `{settings: {key: value}}` (validated per key) |
| Users `[USER_MANAGE]` | `GET/POST /api/admin/users`, `PUT /{id}`, `POST /{id}/reset-password`, `DELETE /{id}` |
| Roles `[ROLE_MANAGE]` | `GET /api/admin/roles`, `GET /api/admin/permissions`, `PUT /api/admin/roles/{id}/permissions` |
| Dashboard `[DASHBOARD_VIEW]` | `GET /api/admin/dashboard/statistics` (counts by status, upcoming/past events, news per month, translation gaps), `GET /recent-activity` |
| Audit `[AUDIT_VIEW]` | `GET /api/admin/audit-logs` (`actor`, `action`, `resourceType`, `from`, `to`) |
| Contact `[MESSAGES_VIEW]` | `GET /api/admin/contact-messages`, `PATCH /{id}` `{status}`, `DELETE /{id}` |

## Media rules

JPEG, PNG, GIF, WebP and PDF only, identified by file signature (never by name or `Content-Type`); SVG/HTML/anything else → 415. Images ≤ 8 MB, PDFs ≤ 50 MB (configurable). JPEG/PNG are decoded, limited to 12 000 px per side, downsized to 2 400 px, re-encoded (this removes EXIF/GPS data) and given a 480 px thumbnail. Original file names are sanitized and used only for display/download; files are stored under random UUID keys.
