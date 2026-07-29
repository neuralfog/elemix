import { expect, test } from '@playwright/test';

test.describe('SvgApp', () => {
    test('SVG-namespaced circle SSRs its attrs and updates cx/cy/r/fill reactively on hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/svg-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('svg-app');
        expect(served).toContain('<svg');
        expect(served).toContain('<circle');
        expect(served).toContain('cx="100"');
        expect(served).toContain('fill="#6366f1"');

        await page.waitForFunction(() => !!customElements.get('svg-app'));

        const circle = page.locator('svg-app circle');
        const moveBtn = page.locator('svg-app button').nth(0);
        const growBtn = page.locator('svg-app button').nth(1);
        const recolorBtn = page.locator('svg-app button').nth(2);

        const ns = await circle.evaluate((el) => el.namespaceURI);
        expect(ns).toBe('http://www.w3.org/2000/svg');

        await expect(circle).toHaveAttribute('cx', '100');
        await expect(circle).toHaveAttribute('cy', '100');
        await expect(circle).toHaveAttribute('r', '40');
        await expect(circle).toHaveAttribute('fill', '#6366f1');

        await moveBtn.click();
        await expect(circle).toHaveAttribute('cx', '60');
        await expect(circle).toHaveAttribute('cy', '140');
        await moveBtn.click();
        await expect(circle).toHaveAttribute('cx', '100');

        await growBtn.click();
        await expect(circle).toHaveAttribute('r', '60');
        await growBtn.click();
        await expect(circle).toHaveAttribute('r', '80');
        await growBtn.click();
        await expect(circle).toHaveAttribute('r', '20');

        await recolorBtn.click();
        await expect(circle).toHaveAttribute('fill', '#ef4444');
        await recolorBtn.click();
        await recolorBtn.click();
        await expect(circle).toHaveAttribute('fill', '#f59e0b');
        await recolorBtn.click();
        await expect(circle).toHaveAttribute('fill', '#6366f1');
    });
});
