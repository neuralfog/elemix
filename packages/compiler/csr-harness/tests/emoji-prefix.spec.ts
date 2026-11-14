import { expect, test } from '@playwright/test';

test('emoji-prefix-app: non-BMP static between two text holes stays reactive (CSR)', async ({
    page,
}) => {
    await page.goto('/view/emoji-prefix-app');
    const e = page.locator('emoji-prefix-app .e');
    await expect(e).toHaveText('A🎉B');

    await page.locator('emoji-prefix-app button').click();
    await expect(e).toHaveText('X🎉Y');
});
