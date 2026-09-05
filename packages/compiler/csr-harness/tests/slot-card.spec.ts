import { expect, test } from '@playwright/test';

test('slot-card: renders nested items, panels and chips', async ({ page }) => {
    await page.goto('/view/slot-card');

    await expect(page.locator('slot-item')).toHaveCount(2);
    await expect(page.locator('slot-panel')).toHaveCount(2);
    await expect(page.locator('slot-chip')).toHaveCount(6);

    await expect(
        page.locator('slot-item').nth(0).locator('.item h3'),
    ).toContainText('Group One');
    await expect(
        page.locator('slot-item').nth(1).locator('.item h3'),
    ).toContainText('Group Two');

    await expect(page.locator('slot-chip .chip')).toHaveText([
        'Alpha',
        'Beta',
        'Gamma',
        'Delta',
        'Epsilon',
        'Zeta',
    ]);
});
