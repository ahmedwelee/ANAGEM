import { expect, test } from './fixtures';
import fs from 'node:fs';
import { ADMIN, COVER, apiToken } from './helpers';

/** What the outside world can reach through the edge (the same routing as deploy/nginx/default.conf). */
test.describe('edge: what is exposed', () => {
  test('the public API answers anyone', async ({ request }) => {
    for (const url of ['/api/public/settings', '/api/public/homepage', '/api/public/news', '/api/public/events', '/api/public/publications', '/api/public/partners']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toContain('json');
    }
  });

  test('the admin API refuses anonymous callers and forged tokens', async ({ request }) => {
    for (const url of ['/api/admin/news', '/api/admin/users', '/api/admin/settings', '/api/admin/audit-logs', '/api/auth/me']) {
      expect((await request.get(url)).status(), url).toBe(401);
      expect((await request.get(url, { headers: { Authorization: 'Bearer forged.token.here' } })).status(), url).toBe(401);
    }
  });

  test('operational and documentation endpoints of the backend are not reachable from outside', async ({ request }) => {
    for (const url of ['/actuator/health', '/actuator/env', '/actuator/beans', '/v3/api-docs', '/swagger-ui.html', '/swagger-ui/index.html']) {
      // The edge hands these to the web server, which answers with its own page (a redirect or a 404), never with the backend's JSON.
      const res = await request.get(url, { maxRedirects: 0 });
      expect(res.headers()['content-type'] ?? '', url).not.toContain('json');
      expect(await res.text(), url).not.toMatch(/"status"\s*:\s*"UP"|propertySources|openapi|swagger-ui-bundle/i);
    }
  });

  test('API errors are JSON with a stable code, not stack traces', async ({ request }) => {
    const res = await request.get('/api/public/news/this-does-not-exist');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(JSON.stringify(body)).not.toMatch(/Exception|at ma\.anagem|org\.springframework/);
  });

  test('signing in works through the edge and wrong credentials give one generic answer', async ({ request }) => {
    expect(await apiToken(request)).toBeTruthy();
    const wrongPassword = await request.post('/api/auth/login', { data: { email: ADMIN.email, password: 'definitely-wrong-password' } });
    const unknownUser = await request.post('/api/auth/login', { data: { email: 'nobody@anagem.test', password: 'definitely-wrong-password' } });
    expect(wrongPassword.status()).toBe(401);
    expect(unknownUser.status()).toBe(401);
    expect((await wrongPassword.json()).message).toBe((await unknownUser.json()).message);
  });

  test('responses carry security headers', async ({ request }) => {
    const api = await request.get('/api/public/settings');
    expect(api.headers()['x-content-type-options']).toBe('nosniff');
    expect(api.headers()['content-security-policy']).toContain("default-src 'none'");
    const page = await request.get('/en');
    expect(page.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('uploads reach the backend and come back as optimised images', async ({ request }) => {
    const token = await apiToken(request);
    const png = fs.readFileSync(COVER);
    const res = await request.post('/api/admin/media/upload', { headers: { Authorization: `Bearer ${token}` }, multipart: { file: { name: 'cover.png', mimeType: 'image/png', buffer: png } } });
    expect(res.status()).toBe(201);
    const media = await res.json();
    expect(media).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', width: 640, height: 400 });
    const served = await request.get(media.url);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toBe('image/png');
    expect((await request.get(media.thumbnailUrl)).status()).toBe(200);
    await request.delete(`/api/admin/media/${media.id}`, { headers: { Authorization: `Bearer ${token}` } });
  });
});
