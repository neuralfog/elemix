import { expect, test } from '@playwright/test';

test('svg-app: moves, grows and recolours the circle', async ({ page }) => {
    await page.goto('/view/svg-app');

    const circle = page.locator('circle');
    const moveBtn = page.locator('button').nth(0);
    const growBtn = page.locator('button').nth(1);
    const recolorBtn = page.locator('button').nth(2);

    await expect(moveBtn).toHaveText('move');
    await expect(growBtn).toHaveText('grow');
    await expect(recolorBtn).toHaveText('recolor');

    expect(await circle.evaluate((el) => el.namespaceURI)).toBe(
        'http://www.w3.org/2000/svg',
    );

    await expect(circle).toHaveAttribute('cx', '100');
    await expect(circle).toHaveAttribute('cy', '100');
    await expect(circle).toHaveAttribute('r', '40');
    await expect(circle).toHaveAttribute('fill', '#6366f1');

    await moveBtn.click();
    await expect(circle).toHaveAttribute('cx', '60');
    await expect(circle).toHaveAttribute('cy', '140');
    await moveBtn.click();
    await expect(circle).toHaveAttribute('cx', '100');
    await expect(circle).toHaveAttribute('cy', '100');

    await growBtn.click();
    await expect(circle).toHaveAttribute('r', '60');
    await growBtn.click();
    await expect(circle).toHaveAttribute('r', '80');
    await growBtn.click();
    await expect(circle).toHaveAttribute('r', '20');
    await growBtn.click();
    await expect(circle).toHaveAttribute('r', '40');

    await recolorBtn.click();
    await expect(circle).toHaveAttribute('fill', '#ef4444');
    await recolorBtn.click();
    await expect(circle).toHaveAttribute('fill', '#22c55e');
    await recolorBtn.click();
    await expect(circle).toHaveAttribute('fill', '#f59e0b');
    await recolorBtn.click();
    await expect(circle).toHaveAttribute('fill', '#6366f1');
});
