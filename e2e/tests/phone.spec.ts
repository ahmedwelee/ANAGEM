import { expect, test } from '@playwright/test';
import { watchForProblems } from './helpers';

/** A visitor on a phone (Pixel 7, 412 px wide). */
test.describe('phone', () => {
  for (const url of ['/ar', '/fr', '/en', '/ar/news', '/ar/events', '/en/contact', '/ar/about']) {
    test(`${url} fits the screen without sideways scrolling or errors`, async ({ page }) => {
      const problems = watchForProblems(page);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'horizontal overflow in px').toBeLessThanOrEqual(1);
      expect(problems).toEqual([]);
    });
  }

  test('the menu opens from the burger button and leads to a page', async ({ page }) => {
    await page.goto('/en');
    const burger = page.getByRole('button', { name: /menu/i });
    await expect(burger).toBeVisible();
    const menuLink = page.locator('#pub-menu').getByRole('link', { name: 'Contact', exact: true });
    await expect(menuLink).toBeHidden();
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await menuLink.click();
    await expect(page).toHaveURL(/\/en\/contact$/);
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  test('the Arabic site is right to left on a phone too', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const box = await page.locator('main').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(412);
  });

  test('the admin sign-in works on a phone', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('anagem.admin.lang', 'en'));
    await page.goto('/admin/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
