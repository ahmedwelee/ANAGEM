# ANAGEM — Quality assurance

## Automated tests

Everything runs with `scripts/test-all.sh` (details, conventions and the list of what the browser tests prove: `docs/testing.md`).

| Suite | Run | What it proves |
|---|---|---|
| Backend — 178 tests: unit tests plus integration tests on a real (embedded) PostgreSQL, real Flyway migrations and the real security filter chain | `cd backend && ./mvnw verify` | Login, lockout and token revocation · role and permission enforcement (Editors cannot publish or edit live content) · user and role management with the "last super administrator" rules · news/event/publication/resource workflow, localization fallback (requested → Arabic → French → English) · categories, partners, settings validation, homepage sections · media validation by file signature, EXIF stripping, thumbnails · contact form, honeypot and rate limits · sitemap data · HTML sanitising · error format and what is (not) exposed (actuator, API docs, CORS, headers) · the `dev` profile and its sample content. Line coverage ≥ 90 % is enforced |
| Frontend — 376 unit/component tests (Vitest + jsdom) | `cd frontend && npx ng test --no-watch --coverage` | Every public page (news, events, publications, magazine, resources, search, CMS pages, 404, header/footer) and admin screen except three (see `docs/testing.md`): list filters, paging and deletion with confirmation, the news/event/publication/resource forms (validation per language, Moroccan time, request bodies), categories, partners, users and roles, messages, audit log, settings, profile · session, guards and access by permission · SEO tags · language switching · XSS safety of rendered content. Coverage floors are enforced |
| End-to-end — 74 tests (Playwright + Chrome) | `cd e2e && npm test` | A real browser on the production build against the real backend: Arabic default and RTL, language memory, server-rendered SEO (title, canonical, hreflang, JSON-LD, sitemap, robots, real 404s), the publish-an-article-with-a-picture journey in three languages, writer vs administrator, contact form to inbox, settings and maintenance mode, no browser errors on 15 pages, phone layout, what the outside can and cannot reach |
| Dictionary completeness | `cd frontend && npm run i18n && node scripts/check-i18n-usage.mjs` | Every translation key exists in French, Arabic and English; every key used in code exists |
| Production build | `cd frontend && npm run build` | Strict TypeScript and template checks; server bundle builds |

Bugs found while building these tests and running the stack (all fixed): validation messages never appeared under form fields (a component cached a value that depends on non-signal form state); an `inject()` call after `await` broke server rendering of every public page; unknown article/event/publication URLs returned HTTP 200 instead of 404; in the Docker stack the web server sent its own API calls back to itself (an endless render loop that exhausted memory); switching to Arabic from another page left the home page hero and title in French; on the Arabic map the city labels overlapped; and, from the full test pass: an upload without a file answered 500, changing the enabled languages in the settings answered 500, the event form emptied its date fields when "all day" was toggled, pasted links with a trailing space were refused, and test helpers broke the production build (see `docs/testing.md`).

## Verified by hand in this build (browser, dev backend with sample content)

- Public site in FR, AR (RTL) and EN: home, news list and article, events list and event, publication, about, contact; language switch keeps the page and updates `<html lang dir>`, title, canonical and hreflang.
- Server-rendered HTML (curl): title, description, canonical, 3 hreflang + x-default, Open Graph, JSON-LD (Organization, NewsArticle, Event, publication), real `404` with `noindex` for unknown URLs, `robots.txt` with sitemap line, `sitemap.xml` with alternates, `/` → `/ar` redirect (or the visitor's saved language), `/en/association` → `/en/about`. These are now also checked automatically by the browser tests.
- Hydration: first load makes **zero** API calls from the browser (data is transferred from the server render); 29 components hydrated, none skipped.
- Contact form: validation, successful submission, confirmation.
- Mobile width (375 px): hero, map, navigation drawer with sub-menus.
- Admin: editor sign-in, dashboard, form validation, status workflow (earlier phases).

## Manual QA matrix (to run before launch)

Tick each cell: ✔ ok · ✖ bug (open an issue) · — not applicable.

| Page / flow | FR desktop | AR desktop (RTL) | EN desktop | Mobile 375 | Tablet 768 |
|---|---|---|---|---|---|
| Home (hero animation, map, quick access, news, events, magazine, partners) | | | | | |
| About, Members, Legal, Privacy (empty page message until written) | | | | | |
| News list, filters, pagination, article, share, related | | | | | |
| Events: upcoming / past / all, type filter, event page, registration link, programme download | | | | | |
| Publications, journal page, PDF download and preview | | | | | |
| Resources: download, external link | | | | | |
| Search (news + events + publications), no-result state | | | | | |
| Contact form (valid, invalid, rate limit after many sends) | | | | | |
| 404 page, article not found | | | | | |
| Menu: dropdowns by mouse, keyboard (Tab/Enter/Esc), mobile drawer | | | | | |

### Roles (admin)

| Role | Check |
|---|---|
| Editor | Can create and edit drafts, upload media, submit for review; cannot publish, cannot edit or delete live content; no Categories, Homepage and pages, Partners, Messages, Users, Settings, Audit in the menu (and the API refuses them) |
| Admin | Can publish, schedule, archive, restore and delete content and media; manage categories, partners, homepage and pages, contact messages; no Users, Roles, Settings, Audit |
| Super admin | Users, roles, settings, audit log, reset a user's password; cannot disable, delete or change own account's role; the last super admin cannot be demoted, disabled or deleted |
| Everyone | Signed-out visit to `/admin/news` redirects to login and returns after sign-in; expired token shows the session message |

### Content and SEO

- [ ] Article with FR only: the AR and EN pages show the French text with the "shown in French" note. Article with AR and FR only: the EN page shows the Arabic text (Arabic is the first fallback, then French, then English). Canonical stays on the requested language.
- [ ] Open `/` with a French or English browser and no saved choice: it lands on `/ar`. Pick French, come back to `/`: it lands on `/fr`.
- [ ] Scheduled article is invisible until its date; archived content disappears from lists, search and sitemap.
- [ ] Rich text: headings, lists, links, images, tables render in RTL; pasted `<script>` or `onclick` is stripped.
- [ ] Share a page on WhatsApp/Facebook/LinkedIn: image, title and description are right (use the platforms' debuggers).
- [ ] Google Rich Results test on an event page and a news page.
- [ ] `view-source:` of any public page shows the article text (not an empty `<app-root>`).

### Accessibility, performance, browsers

- [ ] Keyboard only: skip link, menu, forms, dialogs (focus trapped, Esc closes), visible focus rings.
- [ ] Screen reader pass in Arabic and French (NVDA/VoiceOver): landmarks, form labels and errors, language of each article block (`lang`/`dir` set on articles).
- [ ] Contrast of text on photos in the hero (WCAG AA), `prefers-reduced-motion` stops the animations.
- [ ] Lighthouse mobile ≥ 90 for performance, accessibility, SEO on home and an article.
- [ ] Safari, Firefox, Chrome, Edge (latest) and one Android + one iPhone.

## Not covered

Browser tests run in Chrome only; no load test, no virus scanning of uploads, no screen-reader, Safari or Firefox verification in this build (the manual matrix above). Rate limits are per process (see `docs/deployment.md`).
