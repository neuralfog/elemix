import { expect, test } from '@playwright/test';

test.describe('StyleApp', () => {
    test('object style binding SSRs an inline style and updates each declaration reactively', async ({
        page,
    }) => {
        const response = await page.goto('/style-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('style-app');
        expect(served).toContain('font-size:18px');

        await page.waitForFunction(() => !!customElements.get('style-app'));

        const box = page.locator('style-app .box');
        const colorBtn = page.locator('style-app button').nth(0);
        const sizeBtn = page.locator('style-app button').nth(1);
        const bgBtn = page.locator('style-app button').nth(2);

        const style = (prop: string) =>
            box.evaluate(
                (el, p) => (el as HTMLElement).style.getPropertyValue(p),
                prop,
            );

        expect(await style('color')).toBe('rgb(30, 41, 59)');
        expect(await style('font-size')).toBe('18px');
        expect(await style('background')).toBe('rgb(224, 231, 255)');

        await colorBtn.click();
        expect(await style('color')).toBe('rgb(255, 255, 255)');
        expect(await style('font-size')).toBe('18px');
        expect(await style('background')).toBe('rgb(224, 231, 255)');
        await colorBtn.click();
        expect(await style('color')).toBe('rgb(30, 41, 59)');

        await sizeBtn.click();
        expect(await style('font-size')).toBe('22px');
        await sizeBtn.click();
        await sizeBtn.click();
        expect(await style('font-size')).toBe('30px');
        await sizeBtn.click();
        expect(await style('font-size')).toBe('14px');

        await bgBtn.click();
        expect(await style('background')).toBe('rgb(99, 102, 241)');
        await bgBtn.click();
        expect(await style('background')).toBe('rgb(224, 231, 255)');
    });
});
