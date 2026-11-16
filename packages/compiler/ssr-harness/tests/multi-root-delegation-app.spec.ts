import { expect, test } from '@playwright/test';

test.describe('MultiRootDelegationApp (multi-root rows + custom event after hydrate)', () => {
    test('sibling roots delegate and the custom event keeps its direct binding post-hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/multi-root-delegation-app');
        await page.waitForFunction(
            () => !!customElements.get('multi-root-delegation-app'),
            undefined,
            { timeout: 10_000 },
        );
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
                new CustomEvent('custom-tap', {
                    detail: 'pong',
                    bubbles: true,
                }),
            );
        });
        await expect(log).toHaveText('tap:3:pong');

        expect(errors).toEqual([]);
    });
});
