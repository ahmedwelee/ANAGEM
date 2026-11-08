import { APIRequestContext, Page, expect } from '@playwright/test';
import path from 'node:path';
import { isLocal } from './fixtures';

export const ADMIN = { email: 'e2e-admin@anagem.test', password: 'E2e-Passw0rd-123!' };
export const COVER = path.join(__dirname, '..', 'fixtures', 'cover.png');
export const PDF = path.join(__dirname, '..', 'fixtures', 'issue.pdf');

/** A short unique suffix so every run and every test creates content nobody else touches. */
export const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

export async function apiToken(request: APIRequestContext, creds = ADMIN): Promise<string> {
  const res = await request.post('/api/auth/login', { data: creds });
  expect(res.ok(), `login as ${creds.email}`).toBeTruthy();
  return (await res.json()).accessToken;
}

/** The REST API as an administrator: used to prepare data quickly, so the browser test can focus on what it checks. */
export function adminApi(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const call = async (method: 'post' | 'put' | 'patch' | 'delete', url: string, data?: unknown) => {
    const res = await request[method](url, { headers, data });
    expect(res.status(), `${method.toUpperCase()} ${url}: ${await res.text()}`).toBeLessThan(300);
    return res.status() === 204 ? null : res.json();
  };
  return {
    news: (title: Record<string, string>, extra: Record<string, unknown> = {}) =>
      call('post', '/api/admin/news', { translations: Object.fromEntries(Object.entries(title).map(([l, t]) => [l, { title: t, summary: `Summary ${t}`, content: `<p>Body of ${t}</p>` }])), ...extra }),
    publish: (kind: string, id: number) => call('patch', `/api/admin/${kind}/${id}/status`, { status: 'PUBLISHED' }),
    setStatus: (kind: string, id: number, status: string) => call('patch', `/api/admin/${kind}/${id}/status`, { status }),
    remove: (kind: string, id: number) => call('delete', `/api/admin/${kind}/${id}`),
    createUser: (email: string, fullName: string, roleName: string, password: string) => call('post', '/api/admin/users', { email, fullName, roleName, password, preferredLocale: 'en' }),
    deleteUser: (id: number) => call('delete', `/api/admin/users/${id}`),
    role: async (name: string) => ((await (await request.get('/api/admin/roles', { headers })).json()) as { id: number; name: string; permissions: string[] }[]).find((r) => r.name === name)!,
    setRolePermissions: (roleId: number, permissions: string[]) => call('put', `/api/admin/roles/${roleId}/permissions`, { permissions }),
    settings: (settings: Record<string, unknown>) => call('put', '/api/admin/settings', { settings }),
    get: async (url: string) => (await request.get(url, { headers })).json(),
  };
}

/** The admin interface starts in Arabic; tests read English labels, so choose English before the page loads. */
export async function useAdminLanguage(page: Page, lang: 'fr' | 'ar' | 'en' = 'en') {
  await page.addInitScript((l) => { try { localStorage.setItem('anagem.admin.lang', l); } catch { /* storage blocked */ } }, lang);
}

export async function signIn(page: Page, creds = ADMIN, to = '/admin/login') {
  await page.goto(to);
  await page.getByLabel('Email address').fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Signing in applies the person's preferred language, and the e2e administrator prefers Arabic like everybody: tests read English labels. */
export async function preferEnglish(request: APIRequestContext, creds = ADMIN) {
  const token = await apiToken(request, creds);
  const headers = { Authorization: `Bearer ${token}` };
  const me = await (await request.get('/api/auth/me', { headers })).json();
  if (me.preferredLocale === 'en') return;
  const res = await request.put(`/api/admin/users/${me.id}`, { headers, data: { preferredLocale: 'en' } });
  expect(res.ok(), 'set preferred language').toBeTruthy();
}

export async function signInAsAdmin(page: Page) {
  await preferEnglish(page.request);
  await useAdminLanguage(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
}

/** Collects what a real visitor would not want to see: JavaScript errors, console errors and failed requests. */
export function watchForProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && isLocal(m.location().url || 'http://localhost/')) problems.push(`console: ${m.text()}`); }); // the refused outside requests (fonts) log an error too: not a problem of the site
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (isLocal(r.url()) && !r.url().includes('favicon')) problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`); });
  return problems;
}
