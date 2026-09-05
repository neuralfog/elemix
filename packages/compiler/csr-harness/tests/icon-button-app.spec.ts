import { expect, test } from '@playwright/test';

test('icon-button-app: nested icon-button label set and cleared', async ({
    page,
}) => {
    await page.goto('/view/icon-button-app');

    const button = page.locator('icon-button button');
    const pip = page.locator('.pip');
    await expect(pip).toHaveText('★');
    await expect(button).toHaveText('');

    await page.locator('button.set').click();
    await expect(button).toHaveText('Saved');
    await expect(pip).toHaveText('★');

    await page.locator('button.clear').click();
    await expect(button).toHaveText('');
    await expect(pip).toHaveText('★');
});
