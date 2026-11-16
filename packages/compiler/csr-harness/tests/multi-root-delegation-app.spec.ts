import { expect, test } from '@playwright/test';

test('multi-root-delegation-app: sibling roots delegate, custom event keeps direct binding', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/multi-root-delegation-app');
    const app = page.locator('multi-root-delegation-app');
    const log = app.locator('.log');
    await expect(app.locator('.up')).toHaveCount(3);

    await app.locator('.up[data-id="2"]').click();
    await expect(app.locator('.val[data-id="2"]')).toHaveText('1');
    await expect(log).toHaveText('bump:2:1');

    await app.locator('.down[data-id="2"]').click();
    await expect(app.locator('.val[data-id="2"]')).toHaveText('0');
    await expect(log).toHaveText('bump:2:-1');

    await app.locator('.up[data-id="1"]').click();
    await app.locator('.up[data-id="1"]').click();
    await expect(app.locator('.val[data-id="1"]')).toHaveText('2');

    await page.evaluate(() => {
        const host = document.querySelector('multi-root-delegation-app');
        const btn = host?.shadowRoot?.querySelector('.down[data-id="3"]');
        btn?.dispatchEvent(
            new CustomEvent('custom-tap', { detail: 'pong', bubbles: true }),
        );
    });
    await expect(log).toHaveText('tap:3:pong');

    expect(errors).toEqual([]);
});
