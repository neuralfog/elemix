import { expect, test } from '@playwright/test';

test.describe('ContextApp (ambient request context)', () => {
    test('params/query/csrf SSR, survive hydrate, and re-read on soft-nav while csrf stays stable', async ({
        page,
    }) => {
        const res = await page.goto('/context/alpha?q=one');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('id="__hydris_context"');
        expect(html).toContain('>alpha<');
        expect(html).toContain('>one<');
        expect(html).toContain('stub-csrf-token');

        await page.waitForFunction(
            () => !!customElements.get('nav-link'),
            undefined,
            {
                timeout: 10_000,
            },
        );

        const root = page.locator('context-app');
        await expect(root.locator('.id')).toHaveText('alpha');
        await expect(root.locator('.q')).toHaveText('one');
        await expect(root.locator('.csrf')).toHaveText('stub-csrf-token');

        const softNav = await page.evaluate(
            () => typeof document.body.setHTMLUnsafe === 'function',
        );
        test.skip(!softNav, 'setHTMLUnsafe unsupported');

        await page.locator('#to-beta').click();

        await expect(root.locator('.id')).toHaveText('beta');
        await expect(root.locator('.q')).toHaveText('two');
        await expect(root.locator('.csrf')).toHaveText('stub-csrf-token');

        await page.locator('#to-alpha').click();
        await expect(root.locator('.id')).toHaveText('alpha');
        await expect(root.locator('.q')).toHaveText('one');
    });

    test('missing param/query fall back cleanly', async ({ page }) => {
        await page.goto('/context/solo');
        await page.waitForFunction(
            () => !!customElements.get('context-app'),
            undefined,
            {
                timeout: 10_000,
            },
        );
        const root = page.locator('context-app');
        await expect(root.locator('.id')).toHaveText('solo');
        await expect(root.locator('.q')).toHaveText('-');
        await expect(root.locator('.csrf')).toHaveText('stub-csrf-token');
    });
});
