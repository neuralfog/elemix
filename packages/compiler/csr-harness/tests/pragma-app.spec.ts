import { expect, test } from '@playwright/test';

test('pragma-app: minimal #component/#styles/#state renders a single text hole', async ({
    page,
}) => {
    await page.goto('/view/pragma-app');
    const label = page.locator('pragma-app .label');
    await expect(label).toHaveText('hello');
});
