import { expect, test } from '@playwright/test';

test('dup-class-app: a repeated class token is de-duplicated (CSR)', async ({
    page,
}) => {
    await page.goto('/view/dup-class-app');
    const div = page.locator('dup-class-app div');
    await expect(div).toHaveText('x');
    await expect(div).toHaveClass('btn');
});
