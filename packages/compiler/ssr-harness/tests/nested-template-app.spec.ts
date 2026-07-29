import { expect, test } from '@playwright/test';

test.describe('NestedTemplateApp', () => {
    test('local const tpl vars (one reused twice) SSR and hydrate from a shared reactive cell', async ({
        page,
    }) => {
        const response = await page.goto('/nested-template-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('nested-template-app');
        expect(served).toContain('<h2>Dashboard</h2>');
        expect(served).toContain('and again');

        await page.waitForFunction(
            () => !!customElements.get('nested-template-app'),
        );

        const h2 = page.locator('nested-template-app h2');
        const chips = page.locator('nested-template-app .chip');
        const titleBtn = page.locator('nested-template-app button').nth(0);
        const tagBtn = page.locator('nested-template-app button').nth(1);

        await expect(h2).toHaveText('Dashboard');
        await expect(chips).toHaveText(['new', 'new']);
        await expect(titleBtn).toHaveText('change title');
        await expect(tagBtn).toHaveText('change tag');

        await titleBtn.click();
        await expect(h2).toHaveText('Reports');
        await titleBtn.click();
        await expect(h2).toHaveText('Dashboard');

        await tagBtn.click();
        await expect(chips).toHaveText(['hot', 'hot']);
        await tagBtn.click();
        await expect(chips).toHaveText(['new', 'new']);
    });
});
