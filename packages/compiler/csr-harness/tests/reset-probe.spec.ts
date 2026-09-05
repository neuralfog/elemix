import { expect, test } from '@playwright/test';

test('reset-probe: global reset config styles the shadow content', async ({
    page,
}) => {
    await page.addInitScript(() => {
        (
            window as unknown as {
                __elemix__?: { config?: Record<string, unknown> };
            }
        ).__elemix__ = {
            config: { reset: '.reset-probe{color:rgb(7,8,9)}' },
        };
    });
    await page.goto('/view/reset-probe');

    const probe = page.locator('.reset-probe');
    await expect(probe).toHaveText('probe');
    await expect(probe).toHaveCSS('color', 'rgb(7, 8, 9)');
});
