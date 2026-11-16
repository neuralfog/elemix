import { type Page, expect, test } from '@playwright/test';

const ready = (page: Page): Promise<unknown> =>
    page.waitForFunction(() => !!customElements.get('nav-link'), undefined, {
        timeout: 10_000,
    });

const softNavSupported = (page: Page): Promise<boolean> =>
    page.evaluate(() => typeof document.body.setHTMLUnsafe === 'function');

test.describe('soft-nav resets scroll to the top', () => {
    test('a soft-nav to a different URL snaps to the top', async ({ page }) => {
        await page.goto('/scroll-nav-a');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.evaluate(() => window.scrollTo(0, 2000));
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

        await page.click('#to-b');
        await expect(page.locator('[data-page="b"]')).toBeVisible();
        await page.waitForFunction(() => window.scrollY === 0, undefined, {
            timeout: 5_000,
        });
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('re-navigating to the same URL snaps to the top', async ({ page }) => {
        await page.goto('/scroll-nav-a');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.evaluate(() => window.scrollTo(0, 2000));
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

        await page.click('#to-a');
        await page.waitForFunction(() => window.scrollY === 0, undefined, {
            timeout: 5_000,
        });
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });
});
