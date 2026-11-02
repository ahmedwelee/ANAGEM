import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const API_ORIGIN = process.env['API_ORIGIN'] ?? 'http://localhost:8080';
const PUBLIC_URL = (process.env['PUBLIC_BASE_URL'] ?? 'http://localhost:4300').replace(/\/$/, '');
const LANGS = ['fr', 'ar', 'en'] as const;
const DEFAULT_LANG = 'ar' as const;   // keep in step with DEFAULT_LANG in src/app/core/api/models.ts
const PAGES = ['', 'about', 'news', 'publications', 'magazine', 'events', 'members', 'resources', 'contact', 'legal', 'privacy'];

const app = express();
const angularApp = new AngularNodeAppEngine({
  allowedHosts: (process.env['ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1').split(',').map((h) => h.trim()).filter(Boolean),
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-proto'],   // set by the nginx edge in front of this server
});

app.set('trust proxy', true); // behind nginx: honour X-Forwarded-* headers
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/** Language for "/" : the one the visitor picked last (cookie set by the site), otherwise Arabic, the site default, whatever the browser language is. */
function preferredLang(cookie: string | undefined): (typeof LANGS)[number] {
  const fromCookie = /(?:^|;\s*)anagem_lang=(fr|ar|en)\b/.exec(cookie ?? '')?.[1];
  return (fromCookie as (typeof LANGS)[number] | undefined) ?? DEFAULT_LANG;
}

app.get('/', (req, res) => {
  res.setHeader('Vary', 'Cookie');
  res.redirect(302, `/${preferredLang(req.headers.cookie)}`);
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/admin', '', `Sitemap: ${PUBLIC_URL}/sitemap.xml`, ''].join('\n'));
});

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

app.get('/sitemap.xml', async (_req, res) => {
  type Entry = { ref: string; updatedAt: string };
  let data: { news: Entry[]; events: Entry[]; publications: Entry[]; resources: Entry[] } = { news: [], events: [], publications: [], resources: [] };
  try {
    const r = await fetch(`${API_ORIGIN}/api/public/sitemap`);
    if (r.ok) data = await r.json();
  } catch { /* backend unreachable: still serve the static pages */ }

  const paths: { path: string; lastmod?: string }[] = PAGES.map((p) => ({ path: p }));
  for (const [section, list] of [['news', data.news], ['events', data.events], ['publications', data.publications], ['resources', data.resources]] as const) {
    for (const e of list) paths.push({ path: `${section}/${e.ref}`, lastmod: e.updatedAt });
  }
  const urls = paths.flatMap(({ path, lastmod }) =>
    LANGS.map((lang) => {
      const loc = (l: string) => `${PUBLIC_URL}/${l}${path ? '/' + path : ''}`;
      const alternates = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xml(loc(l))}"/>`).join('');
      return `<url><loc>${xml(loc(lang))}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${xml(loc(DEFAULT_LANG))}"/></url>`;
    }),
  );
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=900');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`);
});

/** Hashed build assets are immutable; everything else (i18n, icons, favicon) revalidates. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, path) => { if (!/-[A-Za-z0-9_]{8}\.(js|css)$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=3600'); },
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`ANAGEM web server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
