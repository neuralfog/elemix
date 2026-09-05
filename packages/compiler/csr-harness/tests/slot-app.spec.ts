import { expect, test } from '@playwright/test';

test('slot-app: renders two cards with slotted content', async ({ page }) => {
    await page.goto('/view/slot-app');

    const cards = page.locator('app-card');
    await expect(cards).toHaveCount(2);

    const first = cards.nth(0);
    await expect(first.locator('.header')).toHaveCount(1);
    await expect(first.locator('.body')).toHaveCount(1);
    await expect(first.locator('.footer')).toHaveCount(1);
    await expect(first).toContainText('⭐ Featured');
    await expect(first).toContainText('Updated just now');
    await expect(first).toContainText(
        'Default-slot content lives in the card body.',
    );

    const second = cards.nth(1);
    await expect(second.locator('.header')).toHaveCount(0);
    await expect(second.locator('.footer')).toHaveCount(0);
    await expect(second.locator('.body')).toHaveCount(1);
    await expect(second).toContainText('This card has only body content');
});
