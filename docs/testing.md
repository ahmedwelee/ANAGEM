# ANAGEM — Testing

Everything is tested at three levels. One command runs all of them:

```bash
scripts/test-all.sh              # backend, frontend and browser tests, then one summary
scripts/test-all.sh --fast       # backend + frontend only (no browser)
scripts/test-all.sh backend      # or: frontend | e2e
```

Needs Java 17+, Node 22+ and Google Chrome (or `E2E_CHANNEL=chromium` after `npx playwright install chromium`). **No Docker and no database to install**: the backend tests and the browser tests start their own throw-away PostgreSQL.

## The three levels

| Level | Where | What it is | Run on its own | Size |
|---|---|---|---|---|
| **Backend** | `backend/src/test` | Plain unit tests for the logic (languages, translation fallback, slugs, HTML sanitising, JWT, rate limiting, file signatures, image processing, storage safety, "last super administrator" rules, error mapping) **and** integration tests that boot the whole application on a real PostgreSQL with the real Flyway migrations and the real security filter chain | `cd backend && ./mvnw verify` | 178 tests |
| **Frontend** | `frontend/src/**/*.spec.ts` | Vitest + Angular `TestBed`: every public page, every admin screen, services, guards, forms. Components are rendered for real; only HTTP is replaced (`HttpTestingController`), so each test states exactly which request the screen must send and how it reacts to each answer | `cd frontend && npx ng test --no-watch` | 353 tests |
| **End-to-end** | `e2e/tests` | **Playwright driving a real Chrome** against the real thing: Spring Boot (production configuration) on PostgreSQL, the built Angular server (server-side rendering), and an edge proxy with the same routing as nginx | `cd e2e && npm test` (after `npm run build` in `frontend`) | 72 tests |

Coverage is measured and has a floor, so it cannot quietly fall: backend ≥ 90 % of lines (JaCoCo, enforced by `mvn verify`; report in `backend/target/site/jacoco/index.html`), frontend ≥ 78 % statements / 74 % branches / 64 % functions / 80 % lines (enforced by `ng test --coverage`; report in `frontend/coverage/`). Today: backend 96.6 % of lines (73 % of branches), frontend 83 % of lines (81 % statements, 78 % branches).

## What the end-to-end tests prove

*Visitors* (`public.spec.ts`, `phone.spec.ts`, `edge.spec.ts`)
- `/` opens in Arabic, right to left, whatever the browser language; a visitor's choice of French or English is remembered; switching language keeps the page and the query.
- The HTML that leaves the server already contains the article text, the title, canonical address, three language alternates plus `x-default`, Open Graph and JSON-LD; unknown addresses are real `404`s marked `noindex`; `robots.txt` and `sitemap.xml` are right; drafts never reach the sitemap.
- The real Kénitra event, the About page (nine objectives) and the Members page are served; news can be listed, opened and searched; an article missing in the visitor's language is shown in Arabic first, with a note.
- Contact form: validation, delivery to the admin inbox, honeypot.
- Quality: 15 pages load without a JavaScript error, console error or failed request; the first visit needs no API call from the browser (the server already sent the data); one `h1` and a skip link per page; nothing wider than the screen on a phone (Pixel 7), the burger menu works.
- Exposure: the admin API refuses anonymous callers and forged tokens, `/actuator` and the API documentation are not reachable from outside, errors are JSON without stack traces, security headers are present, uploads work through the edge.

*Administrators* (`admin.spec.ts`)
- Sign-in (wrong password, redirect and return, sign-out); the admin opens in Arabic and switches language.
- **Write an article in two languages with a picture, publish it, and see it on the English, Arabic and French site**; archive and delete it; leaving a form with unsaved changes asks first.
- A writer can draft and submit for review but not publish, does not see the administration screens, and is refused by the server too; a super administrator creates an account from the screen and the new person can sign in.
- Messages from the contact page reach the inbox and are marked read; settings change the public header; maintenance mode replaces the public pages; the audit log shows who did what.

## How the tests are written

- **Backend**: integration tests extend `IntegrationTestBase` (one embedded PostgreSQL per run, `tokenFor("EDITOR")` creates a user and signs in). Content created by a test gets a unique title, so tests do not depend on each other's data. The `dev` profile test (`DevProfileIntegrationTest`) has its own database because it loads the placeholder content.
- **Frontend**: `src/testing/test-providers.ts` (`provideAppTesting()` uses empty dictionaries, so assertions read translation keys, not wording that editors may change), `src/testing/fixtures.ts` (data builders, `respond()`/`fail()` to answer requests, `signIn(permissions)`, `routeWith()`), `src/testing/setup.ts` (jsdom gaps such as `<dialog>`, loaded for every spec and clearing storage between tests; it imports `afterEach` from `vitest` so it type-checks under any tsconfig, and `src/testing` is excluded from the production build).
- **End-to-end**: `e2e/playwright.config.ts` starts the three servers and stops them cleanly; `e2e/tests/helpers.ts` prepares data through the REST API (fast) and the tests check what a person sees. The backend for these tests is `E2eServer` in the backend *test* sources (production configuration, embedded database, administrator `e2e-admin@anagem.test`). It is never part of the shipped application.
- The browser in the end-to-end tests can only reach this machine (`e2e/tests/fixtures.ts`): the site asks Google for web fonts, and a test must neither wait for nor fail without an internet connection.
- Test data: the databases are thrown away after every run. Nothing here touches a real installation.

## Bugs these tests found (all fixed)

1. Uploading with no file part answered **500** instead of 400.
2. Changing the enabled languages in the settings (without also touching the default language) answered **500**.
3. In the event form, switching **"all day"** on or off blanked the date fields (the browser discards a date written into the other input type).
4. A link pasted with a trailing space was refused although every form trims it before sending.
5. The settings screen counted settings that the server does not have as "changed" (and would have sent them).
6. Test helpers living under `src/` broke the **production build**; they are now excluded from it (found by the full run).
7. A leftover `app.default-locale: fr` setting contradicted the Arabic default; removed.

## What is not covered

- **Cross-browser and devices**: browser tests run in Chrome (desktop and a Pixel 7 profile). Safari, Firefox, a real iPhone and screen readers are in the manual checklist (`docs/qa-checklist.md`).
- **Component tests for three admin screens**: dashboard, media library and homepage editor are only exercised by the browser tests (dashboard loads; the picker uploads and selects an image), not by dedicated component tests.
- **Rich-text editor internals** (TipTap), load and performance, virus scanning of uploads.
- **The Docker images themselves**: the compose stack was smoke-tested by hand; building the `web` image needs more memory than the default Colima VM has. The tests above run the same code outside Docker.
