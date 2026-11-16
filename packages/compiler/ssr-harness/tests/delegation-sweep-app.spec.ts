import { expect, test } from '@playwright/test';

test.describe('DelegationSweepApp (delegated row events after hydrate)', () => {
    test('delegated events dispatch to the right row and handler post-hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/delegation-sweep-app');
        await page.waitForFunction(
            () => !!customElements.get('delegation-sweep-app'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('delegation-sweep-app');
        const log = app.locator('.log');
        await expect(app.locator('.row')).toHaveCount(4);

        await app.locator('.row[data-id="2"] .label').click();
        await expect(log).toHaveText('select:2');

        await app.locator('.row[data-id="3"] .star').dblclick();
        await expect(log).toHaveText('star:3');

        await app.locator('.row[data-id="1"] .edit').fill('hi');
        await expect(log).toHaveText('type:1:hi');

        await app.locator('.row[data-id="4"] .edit').press('Enter');
        await expect(log).toHaveText('key:4:Enter');

        await app.locator('.row[data-id="3"] .edit').focus();
        await app.locator('.row[data-id="3"] .edit').blur();
        await expect(log).toHaveText('blur:3');

        await app.locator('.row[data-id="2"] .rm').click();
        await expect(app.locator('.row')).toHaveCount(3);
        await expect(log).toHaveText('remove:2');

        await app.locator('#add').click();
        await expect(app.locator('.row')).toHaveCount(4);
        await expect(log).toHaveText('add:5');

        await app.locator('.row[data-id="5"] .label').click();
        await expect(log).toHaveText('select:5');

        expect(errors).toEqual([]);
    });
});
