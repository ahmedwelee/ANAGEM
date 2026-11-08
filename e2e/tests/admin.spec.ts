import { expect, test } from './fixtures';
import { ADMIN, COVER, adminApi, apiToken, preferEnglish, signIn, signInAsAdmin, uid, useAdminLanguage } from './helpers';

const toast = (page: import('@playwright/test').Page, text: string) => page.locator('[role="status"]', { hasText: text });

test.describe('admin: signing in', () => {
  test('the admin opens in Arabic, right to left, and can switch language', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await page.getByRole('button', { name: 'fr', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('a wrong password is refused with one clear message', async ({ page }) => {
    await useAdminLanguage(page);
    await signIn(page, { email: ADMIN.email, password: 'definitely-wrong-password' });
    await expect(page.getByText('Incorrect email address or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('an address typed without being signed in leads to sign-in, then straight back', async ({ page }) => {
    await preferEnglish(page.request);
    await useAdminLanguage(page);
    await page.goto('/admin/news');
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fnews/);
    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/news$/);
    await expect(page.getByRole('heading', { name: 'News', exact: true, level: 1 })).toBeVisible();
  });

  test('signing out ends the session', async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole('button', { name: /Super|admin/i }).first().click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin/news');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('the dashboard shows the figures of the site', async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main')).toContainText(/News|Events|Publications/);
  });
});

test.describe('admin: publishing an article', () => {
  test('write an article in two languages with a picture, publish it, and see it on the site', async ({ page, request }) => {
    const id = uid();
    const english = `Coastal erosion ${id}`;
    const arabic = `تآكل السواحل ${id}`;
    await signInAsAdmin(page);
    await page.goto('/admin/news/new');

    // English (the interface language is the first tab)
    await page.locator('#title-en').fill(english);
    await page.locator('#summary-en').fill('How the Moroccan coast is changing');
    await page.locator('[role="tabpanel"]:visible .ProseMirror').click();
    await page.keyboard.type('The coast has retreated by several metres.');
    // Arabic
    await page.getByRole('tab', { name: 'العربية' }).click();
    await page.locator('#title-ar').fill(arabic);

    // The picture: choose it from the computer, it is uploaded and picked at once
    await page.getByRole('button', { name: 'Add a picture' }).click();
    await page.locator('dialog[open] input[type="file"]').setInputFiles(COVER);
    await expect(page.locator('app-media-field img').first()).toBeVisible();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page, 'Saved')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/news\/\d+$/);
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

    // A draft is not public yet
    const token = await apiToken(request);
    const api = adminApi(request, token);
    const found = (await api.get(`/api/admin/news?q=${encodeURIComponent(english)}`)).content[0];
    expect(found.title).toBeTruthy();
    expect((await request.get(`/en/news/${found.slug}`)).status()).toBe(404);

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(toast(page, 'Status updated')).toBeVisible();
    await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();

    // English page: text, summary and the uploaded picture
    await page.goto(`/en/news/${found.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(english);
    await expect(page.locator('.rte-content')).toContainText('The coast has retreated');
    const image = page.locator('article figure img');
    await expect(image).toBeVisible();
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Arabic page: right to left, no "shown in another language" note
    await page.goto(`/ar/news/${found.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(arabic);
    await expect(page.locator('article')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('article .badge-review')).toHaveCount(0);

    // French has no translation: the Arabic text is shown first, with a note
    await page.goto(`/fr/news/${found.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(arabic);
    await expect(page.locator('article .badge-review')).toBeVisible();

    // Listed on the news page with its picture
    await page.goto('/en/news');
    const card = page.locator('article', { has: page.getByRole('heading', { level: 3, name: english }) });
    await expect(card).toBeVisible();
    await expect(card.locator('img')).toBeVisible();

    await api.remove('news', found.id);
  });

  test('archiving removes it from the site, deleting removes it from the dashboard', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const title = `Short lived ${uid()}`;
    const n = await api.news({ en: title });
    await api.publish('news', n.id);
    expect((await request.get(`/en/news/${n.slug}`)).status()).toBe(200);

    await signInAsAdmin(page);
    await page.goto(`/admin/news/${n.id}`);
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(toast(page, 'Status updated')).toBeVisible();
    expect((await request.get(`/en/news/${n.slug}`)).status()).toBe(404);
    await page.goto('/en/news');
    await expect(page.getByRole('heading', { level: 3, name: title })).toHaveCount(0);

    await page.goto('/admin/news');
    await page.getByRole('searchbox').fill(title);
    const row = page.locator('tbody tr', { hasText: title });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(toast(page, 'Deleted')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: title })).toHaveCount(0);
  });

  test('leaving a form with unsaved changes asks first', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/news/new');
    await page.locator('#title-en').fill('Not saved yet');
    await page.getByRole('link', { name: 'Back' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/admin\/news\/new$/);
    await page.getByRole('link', { name: 'Back' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/admin\/news$/);
  });

  test('an event with dates in Moroccan time is shown on the public events page', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const title = `Study day ${uid()}`;
    const start = new Date(Date.now() + 20 * 86400_000).toISOString();
    const res = await request.post('/api/admin/events', {
      headers: { Authorization: `Bearer ${await apiToken(request)}` },
      data: { type: 'STUDY_DAY', startsAt: start, translations: { en: { title, location: 'Rabat' } } },
    });
    expect(res.status()).toBe(201);
    const ev = await res.json();
    await api.publish('events', ev.id);
    await page.goto('/en/events');
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
    await page.getByRole('heading', { level: 3, name: title }).getByRole('link').click();
    await expect(page.locator('aside')).toContainText('Rabat');
    await expect(page.locator('aside time')).toBeVisible();
    await api.remove('events', ev.id);
  });
});

test.describe('admin: roles', () => {
  test('an editor writes and publishes on their own, with no administrator in between, and does not see the administration screens', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const email = `editor-${uid()}@anagem.test`;
    const password = 'Editor-Passw0rd-123!';
    const user = await api.createUser(email, 'Editor Test', 'EDITOR', password);

    await useAdminLanguage(page);
    await signIn(page, { email, password });
    await expect(page).toHaveURL(/\/admin$/);
    const sidebar = page.locator('aside nav');
    await expect(sidebar.getByRole('link', { name: 'News' })).toBeVisible();
    for (const hidden of ['Users & roles', 'Settings', 'Messages', 'Homepage', 'Partners']) await expect(sidebar.getByRole('link', { name: hidden })).toHaveCount(0);

    await page.goto('/admin/users');
    await expect(page.getByText('Access denied')).toBeVisible();

    const title = `Editor article ${uid()}`;
    await page.goto('/admin/news/new');
    await page.locator('#title-en').fill(title);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page, 'Saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0); // editors have no review step
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(toast(page, 'Status updated')).toBeVisible();
    await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();

    // It is on the public site at once: nobody approved it
    const found = (await api.get(`/api/admin/news?q=${encodeURIComponent(title)}`)).content[0];
    expect(found.status).toBe('PUBLISHED');
    expect((await request.get(`/en/news/${found.slug}`)).status()).toBe(200);

    // The editor may correct it while it is live...
    await page.reload();
    await page.locator('#title-en').fill(`${title} corrected`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page, 'Saved')).toBeVisible();
    expect((await request.get(`/en/news/${found.slug}`)).status()).toBe(200);
    await expect(page.locator('app-api-error-banner [role="alert"]')).toHaveCount(0);
    // ...but deleting stays with the administrators
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    await api.remove('news', found.id);
    await api.deleteUser(user.id);
  });

  test('a super administrator can take publishing away from editors: they submit for review again, and an administrator approves', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const role = await api.role('EDITOR');
    expect(role.permissions).toContain('CONTENT_PUBLISH');
    const email = `reviewed-${uid()}@anagem.test`;
    const password = 'Reviewed-Passw0rd-123!';
    const user = await api.createUser(email, 'Reviewed Editor', 'EDITOR', password);
    try {
      await api.setRolePermissions(role.id, role.permissions.filter((p) => p !== 'CONTENT_PUBLISH')); // one worker: no other test runs meanwhile

      await useAdminLanguage(page);
      await signIn(page, { email, password });
      await expect(page).toHaveURL(/\/admin$/);
      const title = `Reviewed draft ${uid()}`;
      await page.goto('/admin/news/new');
      await page.locator('#title-en').fill(title);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(toast(page, 'Saved')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publish now' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Submit for review' }).click();
      await expect(toast(page, 'Status updated')).toBeVisible();
      await expect(page.getByText('Pending review', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0);

      // The administrator approves it
      const found = (await api.get(`/api/admin/news?q=${encodeURIComponent(title)}`)).content[0];
      expect(found.status).toBe('PENDING_REVIEW');
      await api.publish('news', found.id);
      expect((await request.get(`/en/news/${found.slug}`)).status()).toBe(200);

      // Now it is live: this editor may no longer change it, and the server says so
      await page.reload();
      await page.locator('#title-en').fill(`${title} changed`);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('app-api-error-banner [role="alert"]')).toBeVisible();

      await api.remove('news', found.id);
    } finally {
      await api.setRolePermissions(role.id, role.permissions); // back to the default: editors publish
      await api.deleteUser(user.id);
    }
  });

  test('the editor is refused by the server too, not only hidden by the screens: no administration, no deleting', async ({ request }) => {
    const api = adminApi(request, await apiToken(request));
    const email = `editor-${uid()}@anagem.test`;
    const password = 'Editor-Passw0rd-123!';
    const user = await api.createUser(email, 'Editor Api', 'EDITOR', password);
    const token = await apiToken(request, { email, password });
    const headers = { Authorization: `Bearer ${token}` };
    for (const url of ['/api/admin/users', '/api/admin/settings', '/api/admin/audit-logs', '/api/admin/partners', '/api/admin/contact-messages']) {
      expect((await request.get(url, { headers })).status(), url).toBe(403);
    }
    expect((await request.post('/api/admin/categories', { headers, data: { type: 'NEWS', translations: { en: { name: 'x' } } } })).status()).toBe(403);
    const n = await api.news({ en: `Not for the editor to delete ${uid()}` });
    expect((await request.delete(`/api/admin/news/${n.id}`, { headers })).status()).toBe(403);
    await api.remove('news', n.id);
    await api.deleteUser(user.id);
  });

  test('a super administrator creates an account from the screen and the new person can sign in', async ({ page, request }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'New user' }).click();
    const email = `created-${uid()}@anagem.test`;
    await page.locator('#ue').fill(email);
    await page.locator('#un').fill('Created In UI');
    const password = await page.locator('#up').inputValue();
    expect(password).toHaveLength(18);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'Saved')).toBeVisible();
    const row = page.locator('tbody tr', { hasText: email });
    await expect(row).toBeVisible();

    const token = await apiToken(request, { email, password });
    expect(token).toBeTruthy();

    const api = adminApi(request, await apiToken(request));
    const users = await api.get('/api/admin/users');
    await api.deleteUser(users.find((u: { email: string }) => u.email === email).id);
  });
});

test.describe('admin: messages and settings', () => {
  test('a message sent from the contact page reaches the inbox and is marked as read when opened', async ({ page }) => {
    const text = `Question from a visitor ${uid()}`;
    await page.goto('/en/contact');
    await page.locator('#c-name').fill('Karim Bennani');
    await page.locator('#c-email').fill('karim@example.org');
    await page.locator('#c-message').fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Message sent')).toBeVisible();

    await signInAsAdmin(page);
    await page.goto('/admin/messages');
    const item = page.locator('li button', { hasText: text });
    await expect(item).toBeVisible();
    await expect(item.locator('.font-bold').first()).toBeVisible(); // unread: bold
    await item.click();
    await expect(page.getByRole('dialog')).toContainText('karim@example.org');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Reply' })).toHaveAttribute('href', /mailto:karim@example\.org/);
    await page.keyboard.press('Escape');
    await expect(item.locator('.font-bold')).toHaveCount(0); // now read
  });

  test('a contact e-mail entered in the settings appears at the top of every public page', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const email = `contact-${uid()}@anagem.test`;
    await signInAsAdmin(page);
    await page.goto('/admin/settings');
    await page.locator('input[id="contact.email"]').fill(email);
    await page.getByRole('button', { name: /Save/ }).click();
    await expect(toast(page, 'Saved')).toBeVisible();

    await page.goto('/en');
    await expect(page.locator(`header a[href="mailto:${email}"]`)).toBeVisible();
    await api.settings({ 'contact.email': '' });
    await page.reload();
    await expect(page.locator('header a[href^="mailto:"]')).toHaveCount(0);
  });

  test('maintenance mode replaces the public pages with the message, and the admin keeps working', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    await api.settings({ 'maintenance.enabled': true, 'maintenance.message': { fr: 'Retour demain.', ar: 'نعود غدا.', en: 'Back tomorrow.' } });
    try {
      await page.goto('/en');
      await expect(page.locator('main')).toContainText('Back tomorrow.');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/maintenance/i);
      await signInAsAdmin(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await api.settings({ 'maintenance.enabled': false });
    }
    await page.goto('/en');
    await expect(page.locator('main')).not.toContainText('Back tomorrow.');
  });

  test('the audit log shows who did what', async ({ page, request }) => {
    const api = adminApi(request, await apiToken(request));
    const n = await api.news({ en: `Audited ${uid()}` });
    await signInAsAdmin(page);
    await page.goto('/admin/audit');
    await expect(page.locator('tbody tr', { hasText: 'Created news' }).first()).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: ADMIN.email }).first()).toBeVisible();
    await api.remove('news', n.id);
  });
});
