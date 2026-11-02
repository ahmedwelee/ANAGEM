import { expect, test } from './fixtures';
import { adminApi, apiToken, uid, watchForProblems } from './helpers';

/** The national meeting in Kénitra: the one real event the database starts with (migration V3). */
const COLLOQUE = 'rencontre-nationale-des-geographes-marocains-2026';
const COLLOQUE_AR = 'الملتقى الوطني للجغرافيين المغاربة';

test.describe('visitor: language', () => {
  test('the site opens in Arabic, right to left, whatever the browser language', async ({ page }) => {
    await page.goto('/'); // the browser is configured as en-GB
    await expect(page).toHaveURL(/\/ar\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('a visitor who picked French is taken back to French next time', async ({ page }) => {
    await page.goto('/ar');
    await page.locator('header a[hreflang="fr"]').click();
    await expect(page).toHaveURL(/\/fr\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr\/?$/);
  });

  test('switching language keeps the page and the query', async ({ page }) => {
    await page.goto('/en/events?scope=PAST');
    await page.locator('header a[hreflang="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/events\?scope=PAST$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('English is available too', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('link', { name: 'Contact', exact: true }).first()).toBeVisible();
  });
});

test.describe('visitor: what search engines and link previews see (server-rendered HTML)', () => {
  test('an event page carries its title, canonical address, language alternates, Open Graph and structured data', async ({ request }) => {
    const res = await request.get(`/en/events/${COLLOQUE}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toContain('National Meeting of Moroccan Geographers');
    expect(html).toMatch(/<title>National Meeting of Moroccan Geographers — [^<]+<\/title>/);
    expect(html).toMatch(new RegExp(`<link[^>]*rel="canonical"[^>]*href="http://localhost:24080/en/events/${COLLOQUE}"`));
    for (const l of ['fr', 'ar', 'en', 'x-default']) expect(html, `hreflang ${l}`).toContain(`hreflang="${l}"`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Event"');
  });

  test('x-default points to the Arabic page', async ({ request }) => {
    const html = await (await request.get('/fr/about')).text();
    expect(html).toMatch(/<link[^>]*hreflang="x-default"[^>]*href="http:\/\/localhost:24080\/ar\/about"|<link[^>]*href="http:\/\/localhost:24080\/ar\/about"[^>]*hreflang="x-default"/);
  });

  test('the article text is in the HTML itself, not only after JavaScript runs', async ({ request }) => {
    const api = adminApi(request, await apiToken(request));
    const title = `Server rendered ${uid()}`;
    const n = await api.news({ en: title });
    await api.publish('news', n.id);
    const html = await (await request.get(`/en/news/${n.slug}`)).text();
    expect(html).toContain(title);
    expect(html).toContain(`Body of ${title}`);
    expect(html).toContain('"@type":"NewsArticle"');
    await api.remove('news', n.id);
  });

  test('unknown addresses are real 404s that search engines are told to skip', async ({ request }) => {
    for (const url of ['/en/news/does-not-exist', '/en/events/does-not-exist', '/en/publications/999999', '/en/nothing-here']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(404);
      expect(await res.text(), url).toContain('noindex');
    }
  });

  test('robots.txt keeps the admin out and announces the sitemap', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: http://localhost:24080/sitemap.xml');
  });

  test('sitemap.xml lists the public pages in every language with their alternates', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const xml = await res.text();
    for (const l of ['fr', 'ar', 'en']) expect(xml).toContain(`<loc>http://localhost:24080/${l}/about</loc>`);
    expect(xml).toContain(`/ar/events/${COLLOQUE}`);
    expect(xml).toContain('xhtml:link');
    expect(xml).not.toContain('/admin');
  });

  test('a draft never reaches the sitemap or the public pages', async ({ request }) => {
    const api = adminApi(request, await apiToken(request));
    const n = await api.news({ en: `Secret draft ${uid()}` });
    expect((await request.get(`/en/news/${n.slug}`)).status()).toBe(404);
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain(n.slug);
    await api.remove('news', n.id);
  });
});

test.describe('visitor: browsing', () => {
  test('the association pages come from the statutes: nine objectives and the member categories', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('ol li')).toHaveCount(9);
    await page.goto('/en/members');
    await expect(page.getByRole('heading', { name: 'Active members' })).toBeVisible();
  });

  test('the Kénitra meeting is on the events page and opens its own page', async ({ page }) => {
    await page.goto('/ar/events?scope=ALL'); // the meeting took place in October 2026: it is no longer "upcoming"
    const card = page.getByRole('heading', { level: 3, name: COLLOQUE_AR });
    await expect(card).toBeVisible();
    await card.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/ar/events/${COLLOQUE}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('الملتقى الوطني');
    await expect(page.locator('article')).toContainText('القنيطرة');
  });

  test('"Home" in the menu and the footer leads to the home page from any page, never to "Page not found"', async ({ page }) => {
    for (const lang of ['ar', 'en']) {
      for (const from of [`/${lang}/news`, `/${lang}/about`, `/${lang}/events`]) {
        const homeLinks = (scope: string) => page.locator(`${scope} a[href="/${lang}"]`);
        for (const scope of ['nav[aria-label] ul', 'footer']) {
          await page.goto(from);
          const link = homeLinks(scope).first();
          await expect(link, `${scope} on ${from}`).toBeVisible();
          await link.click();
          await expect(page).toHaveURL(new RegExp(`/${lang}$`));
          await expect(page.getByRole('heading', { level: 1 }), `home from ${from} via ${scope}`).toBeVisible();
          await expect(page).not.toHaveTitle(/^404/);
        }
      }
    }
  });

  test('a home address with a trailing slash shows the home page', async ({ page }) => {
    await page.goto('/en/');
    await expect(page).not.toHaveTitle(/^404/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('the menu leads to the contact page', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('link', { name: 'Contact', exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/contact$/);
    await expect(page.locator('#c-name')).toBeVisible();
  });

  test('news published by an administrator shows up in the list, with its picture, and can be opened', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const title = `Fresh news ${uid()}`;
    const n = await api.news({ en: title });
    await api.publish('news', n.id);
    await page.goto('/en/news');
    const card = page.getByRole('heading', { level: 3, name: title });
    await expect(card).toBeVisible();
    await card.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/en/news/${n.slug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await api.remove('news', n.id);
  });

  test('searching finds news and says so when nothing matches', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const word = `Coastline${uid()}`;
    const n = await api.news({ en: `Atlas of the ${word}` });
    await api.publish('news', n.id);

    await page.goto('/en');
    await page.locator('header form[role="search"] input').fill(word);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/en/search\\?q=${word}`));
    await expect(page.getByRole('heading', { level: 3, name: `Atlas of the ${word}` })).toBeVisible();

    await page.goto('/en/search?q=zzzzqqqq');
    await expect(page.getByText('zzzzqqqq').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
    await api.remove('news', n.id);
  });

  test('an article missing in the visitor language is shown in Arabic first, with a note', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const id = uid();
    const n = await api.news({ ar: `مقال عربي ${id}`, fr: `Article français ${id}` });
    await api.publish('news', n.id);
    await page.goto(`/en/news/${n.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`مقال عربي ${id}`);
    await expect(page.locator('article')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('article .badge')).toBeVisible();
    await page.goto(`/fr/news/${n.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Article français ${id}`);
    await api.remove('news', n.id);
  });

  test('an unknown article shows a friendly message and the real 404 status', async ({ page }) => {
    const res = await page.goto('/en/news/this-article-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('does not exist');
  });
});

test.describe('visitor: contact form', () => {
  test('sends a message and confirms it', async ({ page, request }) => {
    const text = `Hello from the e2e test ${uid()}`;
    await page.goto('/en/contact');
    await page.locator('#c-name').fill('Amina Alaoui');
    await page.locator('#c-email').fill('amina@example.org');
    await page.locator('#c-subject').fill('Membership');
    await page.locator('#c-message').fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Message sent')).toBeVisible();

    const api = adminApi(request, await apiToken(request));
    const messages = await api.get('/api/admin/contact-messages?size=100');
    expect(messages.content.some((m: { message: string; email: string }) => m.message === text && m.email === 'amina@example.org')).toBe(true);
  });

  test('explains what is missing before sending anything', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/public/contact')) posted = true; });
    await page.goto('/en/contact');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.field-error').first()).toBeVisible();
    expect(posted).toBe(false);
  });

  test('a robot that fills the hidden field is silently ignored', async ({ request }) => {
    const spam = `buy cheap stuff ${uid()}`;
    const res = await request.post('/api/public/contact', { data: { name: 'Bot', email: 'bot@example.org', message: spam, website: 'http://spam.example' } });
    expect(res.status()).toBe(201);
    const api = adminApi(request, await apiToken(request));
    const messages = await api.get('/api/admin/contact-messages?size=100');
    expect(messages.content.some((m: { message: string }) => m.message === spam)).toBe(false);
  });
});

test.describe('visitor: quality', () => {
  const PAGES = ['/ar', '/fr', '/en', '/en/news', '/en/events', '/en/publications', '/en/magazine', '/en/resources', '/en/about', '/en/members', '/en/contact', '/en/search?q=a', '/ar/news', '/ar/events', '/fr/events'];

  for (const url of PAGES) {
    test(`${url} loads without errors`, async ({ page }) => {
      const problems = watchForProblems(page);
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
      expect(problems).toEqual([]);
    });
  }

  test('the first visit makes no API calls from the browser: the server already sent the data', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/public')) calls.push(r.url()); });
    await page.goto('/en/news');
    await page.waitForLoadState('networkidle');
    expect(calls).toEqual([]);
  });

  test('every page has one main heading and a way to skip to the content', async ({ page }) => {
    for (const url of ['/en', '/en/news', '/en/about', '/en/contact']) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 }), url).toHaveCount(1);
      await expect(page.locator('a[href="#main"]'), url).toHaveCount(1);
    }
  });

  test('images have alternative text attributes and nothing is wider than the screen', async ({ page }) => {
    await page.goto('/en');
    const missingAlt = await page.locator('img:not([alt])').count();
    expect(missingAlt).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
