import { expect, test } from '@playwright/test';

test.describe('html() directive', () => {
    test('SSR renders the html() string as raw markup inside the element, unescaped', async ({
        page,
    }) => {
        const res = await page.goto('/html-directive-app');
        const html = (await res?.text()) ?? '';

        expect(html).toContain(
            '<div id="sink"><strong class="m">bold</strong> raw</div>',
        );
        expect(html).not.toContain('&lt;strong');
    });

    test('the raw markup hydrates and updates reactively', async ({ page }) => {
        await page.goto('/html-directive-app');
        await page.waitForFunction(
            () => !!customElements.get('html-directive-app'),
            undefined,
            { timeout: 10_000 },
        );

        const sink = page.locator('html-directive-app #sink');
        await expect(sink.locator('strong.m')).toHaveText('bold');

        await page.locator('html-directive-app #swap').click();
        await expect(sink.locator('em.m')).toHaveText('italic');
        await expect(sink.locator('strong.m')).toHaveCount(0);
    });
});
