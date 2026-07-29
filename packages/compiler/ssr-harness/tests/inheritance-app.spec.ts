import { expect, test } from '@playwright/test';

test.describe('InheritanceApp', () => {
    test('derived extends base: both lifecycle hooks + both stylesheets + reactivity', async ({
        page,
    }) => {
        const response = await page.goto('/inheritance-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('inherit-derived');
        expect(served).toContain('count 0');

        await page.waitForFunction(
            () => !!customElements.get('inherit-derived'),
        );

        const host = page.locator('inherit-derived');
        const btn = page.locator('inherit-derived .btn');

        await expect(btn).toHaveText('count 0');

        await expect(host).toHaveAttribute('data-base', 'on');
        await expect(host).toHaveAttribute('data-derived', 'on');
        await expect(host).toHaveAttribute('data-base-fx', '0');
        await expect(host).toHaveAttribute('data-derived-fx', '0');

        const fontWeight = await btn.evaluate(
            (el) => getComputedStyle(el).fontWeight,
        );
        expect(fontWeight).toBe('700');
        const background = await btn.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        );
        expect(background).toBe('rgb(220, 38, 38)');

        await btn.click();
        await expect(btn).toHaveText('count 1');
        await expect(host).toHaveAttribute('data-base-fx', '1');
        await expect(host).toHaveAttribute('data-derived-fx', '1');

        await btn.click();
        await btn.click();
        await expect(btn).toHaveText('count 3');
        await expect(host).toHaveAttribute('data-base-fx', '3');
        await expect(host).toHaveAttribute('data-derived-fx', '3');
    });
});
