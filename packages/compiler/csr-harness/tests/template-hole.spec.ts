import { expect, test } from '@playwright/test';

test('template-hole-app: a template-valued text hole renders and stays reactive (CSR)', async ({
    page,
}) => {
    await page.goto('/view/template-hole-app');
    const frag = page.locator('template-hole-app .frag');
    await expect(frag).toHaveText('frag-0');

    await page.locator('template-hole-app button').click();
    await expect(frag).toHaveText('frag-1');
});
