import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page): Promise<unknown> =>
    page.waitForFunction(() => !!customElements.get('nav-link'), undefined, {
        timeout: 10_000,
    });

const softNavSupported = (
    page: import('@playwright/test').Page,
): Promise<boolean> =>
    page.evaluate(() => typeof document.body.setHTMLUnsafe === 'function');

test.describe('module #state resets on soft-nav', () => {
    test('SSR always renders module #state fresh (per-request scope)', async ({
        request,
    }) => {
        const res = await request.get('/nav-state-a');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('data-count="0"');
    });

    test('module #state does NOT survive a soft-nav boundary', async ({
        page,
    }) => {
        await page.goto('/nav-state-a');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#inc-a');
        await page.click('#inc-a');
        await page.click('#inc-a');
        await expect(page.locator('#state-a')).toHaveText('3');

        await page.click('#to-state-b');
        await expect(page.locator('#state-b')).toHaveText('0');

        await page.click('#to-state-a');
        await expect(page.locator('#state-a')).toHaveText('0');
    });

    test('a fresh mutation after nav starts from the reset baseline', async ({
        page,
    }) => {
        await page.goto('/nav-state-a');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#inc-a');
        await page.click('#to-state-b');
        await page.click('#to-state-a');
        await page.click('#inc-a');
        await expect(page.locator('#state-a')).toHaveText('1');
    });
});
