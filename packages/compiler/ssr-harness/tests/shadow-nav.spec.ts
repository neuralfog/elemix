import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page): Promise<unknown> =>
    page.waitForFunction(() => !!customElements.get('nav-link'), undefined, {
        timeout: 10_000,
    });

const softNavSupported = (
    page: import('@playwright/test').Page,
): Promise<boolean> =>
    page.evaluate(() => typeof document.body.setHTMLUnsafe === 'function');

test.describe('soft navigation nested in a shadow component', () => {
    test('SSR renders the nav-links that live inside a nested shadow shell', async ({
        page,
    }) => {
        const res = await page.goto('/shadow-nav-home');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('<title>Home</title>');
        expect(html).toContain('content="home"');
        expect(html).toContain('route="/shadow-nav-about"');
        expect(html).toContain('id="to-about"');
    });

    test('nav-link soft-navigates without a full reload; swaps body + title', async ({
        page,
    }) => {
        await page.goto('/shadow-nav-home');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#to-about');
        await page.waitForFunction(
            () => location.pathname === '/shadow-nav-about',
        );

        await expect(page.locator('#page')).toHaveAttribute(
            'data-page',
            'about',
        );
        expect(await page.title()).toBe('About');
    });

    test('a swapped-in page hydrates (state and events work)', async ({
        page,
    }) => {
        await page.goto('/shadow-nav-about');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#to-home');
        await page.waitForFunction(
            () => location.pathname === '/shadow-nav-home',
        );
        await page.waitForSelector('#counter');

        await expect(page.locator('#counter')).toHaveText('count 0');
        await page.click('#counter');
        await expect(page.locator('#counter')).toHaveText('count 1');
    });
});
