import { expect, test } from '@playwright/test';

test.describe('ScssApp', () => {
    test('scss?inline compiles server-side into the DSD style and adopts on the client; reactive', async ({
        page,
    }) => {
        const response = await page.goto('/scss-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('scss-app');
        expect(served).toContain('<style data-ssr>');
        expect(served).toContain('#6366f1');
        expect(served).toContain('button:hover');
        expect(served).not.toContain('$accent');
        expect(served).toContain('count is 0');

        await page.waitForFunction(() => !!customElements.get('scss-app'));

        const host = page.locator('scss-app');
        const card = page.locator('scss-app .card');
        const button = page.locator('scss-app button');

        await expect(card).toBeVisible();
        await expect(button).toHaveText('count is 0');

        const cssText = await host.evaluate((el) => {
            const sheets = (el as Element & { shadowRoot: ShadowRoot | null })
                .shadowRoot?.adoptedStyleSheets;
            if (!sheets || sheets.length === 0) return '';
            return sheets
                .flatMap((s) => Array.from(s.cssRules).map((r) => r.cssText))
                .join('\n');
        });
        expect(cssText).toContain('#6366f1');
        expect(cssText).toContain('button:hover');
        expect(cssText).not.toContain('$accent');

        const background = await button.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        expect(background).toBe('rgb(99, 102, 241)');

        await button.click();
        await expect(button).toHaveText('count is 1');
        await button.click();
        await expect(button).toHaveText('count is 2');
    });
});
