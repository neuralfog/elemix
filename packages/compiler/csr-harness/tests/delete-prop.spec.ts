import { expect, test } from '@playwright/test';

test('delete-prop-app: deleting a tracked property re-renders', async ({
    page,
}) => {
    await page.goto('/view/delete-prop-app');
    const val = page.locator('delete-prop-app .val');
    await expect(val).toHaveText('present');

    await page.locator('delete-prop-app button').click();
    await expect(val).toHaveText('');
});
