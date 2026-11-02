import { test as base, expect } from '@playwright/test';

/** Addresses served by this machine (the site, the API) and non-network URLs such as data: images. */
export const isLocal = (url: string) => !/^https?:/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);

/**
 * Same as Playwright's `test`, but the browser can only reach this machine. The site asks Google for web fonts; a test must not
 * wait for (or fail without) an internet connection, so everything else is refused at once and the page uses its fallback fonts.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route((url) => !isLocal(url.href), (route) => route.abort());
    await use(context);
  },
});

export { expect };
