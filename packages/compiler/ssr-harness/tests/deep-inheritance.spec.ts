import { expect, test } from '@playwright/test';

test.describe('DeepInheritanceApp', () => {
    test('4-level inheritance: every ancestor lifecycle hook fires on hydrate; reactive', async ({
        page,
    }) => {
        const response = await page.goto('/deep-inheritance-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('count 0');

        await page.waitForFunction(() => !!customElements.get('deep-leaf'));

        const host = page.locator('deep-leaf');
        const btn = page.locator('deep-leaf .btn');

        await expect(btn).toHaveText('count 0');

        for (const attr of [
            'data-base',
            'data-middle',
            'data-leg',
            'data-leaf',
        ]) {
            await expect(host).toHaveAttribute(attr, 'on');
        }
        for (const attr of [
            'data-base-fx',
            'data-middle-fx',
            'data-leg-fx',
            'data-leaf-fx',
        ]) {
            await expect(host).toHaveAttribute(attr, '0');
        }

        await btn.click();
        await expect(btn).toHaveText('count 1');
        for (const attr of [
            'data-base-fx',
            'data-middle-fx',
            'data-leg-fx',
            'data-leaf-fx',
        ]) {
            await expect(host).toHaveAttribute(attr, '1');
        }
    });
});
