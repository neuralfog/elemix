import { expect, test } from '@playwright/test';

test.describe('MxListInConditional (list inside a conditional, hydration)', () => {
    test('toggle the whole list off/on and mutate while shown after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-list-in-conditional');
        await page.waitForFunction(
            () => !!customElements.get('mx-list-in-conditional'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-list-in-conditional');
        await expect(app.locator('.list')).toHaveCount(1);
        await expect(app.locator('.list')).toHaveText('ab');

        await app.locator('#toggle').click();
        await expect(app.locator('.list')).toHaveCount(0);

        await app.locator('#toggle').click();
        await expect(app.locator('.list')).toHaveText('ab');

        await app.locator('#add').click();
        await expect(app.locator('.list')).toHaveText('abn3');
        await expect(app.locator('.row')).toHaveCount(3);

        await app.locator('#toggle').click();
        await expect(app.locator('.list')).toHaveCount(0);
        await app.locator('#toggle').click();
        await expect(app.locator('.list')).toHaveText('abn3');

        expect(errors).toEqual([]);
    });
});
