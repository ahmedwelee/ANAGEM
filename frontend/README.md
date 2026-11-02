# ANAGEM frontend

Angular 22 application: the public website (server-side rendered, `/fr`, `/ar`, `/en`) and the admin dashboard (`/admin`). Overview of the whole project: `../README.md`; how the frontend is put together: `../docs/architecture/01-architecture-and-roadmap.md`.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Dev server on http://localhost:4300 with server rendering. Regenerates icons and dictionaries first. Needs the backend: set `API_TARGET` (browser `/api` proxy, see `proxy.conf.mjs`) and `API_ORIGIN` (server-side rendering calls) to the backend URL, and `PUBLIC_BASE_URL` for canonical links |
| `npx ng test --no-watch` | 362 unit and component tests (Vitest, jsdom); add `--coverage` for the report in `coverage/` (floors are enforced) |
| `npm run build` | Production build into `dist/anagem-frontend` (`browser/` + `server/server.mjs`) |
| `node dist/anagem-frontend/server/server.mjs` | Run the built server (`PORT`, `API_ORIGIN`, `PUBLIC_BASE_URL`, `ALLOWED_HOSTS`). Behind nginx in Docker (`Dockerfile`) |
| `npm run i18n` | Merge `i18n-src/*.json` into `public/i18n/{fr,ar,en}.json`; fails if a key is missing in a language |
| `node scripts/check-i18n-usage.mjs` | Fails if the code uses a translation key that does not exist |
| `npm run icons` | Build `public/icons.svg` from the icon names listed in `scripts/build-icons.mjs` (Lucide) |

## Where things are

```
src/app/
  core/        api clients (typed to the backend DTOs), auth (session, guards, interceptor), i18n (LangService), SEO (SeoService, SiteStore)
  shared/      reusable components (forms, tables, modal, rich-text editor, charts...) and utilities
  features/
    public/    layout (header, footer), home, news, events, publications, resources, pages (CMS pages, contact, 404), search
    admin/     one folder per screen (news, events, publications, resources, media, categories, partners, homepage, settings, users, audit, messages...)
  server.ts    Express server: security headers, / redirect, robots.txt, sitemap.xml, static files, Angular handler
src/styles/    tokens.css (colours, fonts, spacing, motion) shared with the Tailwind theme in src/styles.css
i18n-src/      translations, one file per area, French / Arabic / English side by side
```

## Conventions

- **Translations**: never hard-code visible text. Add the key to the right `i18n-src/*.json` in all three languages, run `npm run i18n`. Content written by editors comes from the API already localized.
- **RTL**: use logical utilities (`ps-*`, `me-*`, `start-*`, `text-start`) and `rtl:` variants; flip directional icons with `rtl:-scale-x-100`.
- **State**: signals; async work in `effect()` goes inside `untracked()`; anything that calls `inject()` after an `await` must grab its dependencies first.
- **Public pages** set their SEO with `SeoService.set()` and must mark unknown content with `injectNotFound()` so the server answers 404.
- **Tests** sit next to the code (`*.spec.ts`); use `provideAppTesting()` from `src/testing/test-providers.ts`, which uses empty dictionaries so assertions check translation keys, not wording.
