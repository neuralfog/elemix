import { expect, test } from '@playwright/test';

test('effect-app: effect writes host data attributes on count change', async ({
    page,
}) => {
    await page.goto('/view/effect-app');

    const app = page.locator('effect-app');
    await expect(app).toHaveAttribute('data-count', '0');
    await expect(app).not.toHaveAttribute('data-changed');

    await page.locator('.inc').click();
    await expect(page.locator('.count')).toHaveText('1');
    await expect(app).toHaveAttribute('data-count', '1');
    await expect(app).toHaveAttribute('data-changed', '1');
});
