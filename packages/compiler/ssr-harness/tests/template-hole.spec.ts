import { expect, test } from '@playwright/test';

test.describe('template-hole (SSR + hydrate)', () => {
    test('a template-valued text hole survives hydration and stays reactive', async ({
        page,
    }) => {
        await page.goto('/template-hole-app');
        await page.waitForFunction(
            () => !!customElements.get('template-hole-app'),
        );
        const frag = page.locator('template-hole-app .frag');
        await expect(frag).toHaveText('frag-0');

        await page.locator('template-hole-app button').click();
        await expect(frag).toHaveText('frag-1');
    });
});
