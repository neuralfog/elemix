import { expect, test } from '@playwright/test';

test.describe('MxLiveChildTeardown (drop a live child, hydration)', () => {
    test('dropping a child with live state disposes cleanly and remounts fresh after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-live-child-teardown');
        await page.waitForFunction(
            () => !!customElements.get('mx-live-child-teardown'),
            undefined,
            { timeout: 10_000 },
        );
        await page.waitForFunction(
            () => !!customElements.get('mx-counter-child'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-live-child-teardown');
        await expect(app.locator('mx-counter-child')).toHaveCount(1);
        await expect(app.locator('.child-count')).toHaveText('0');

        await app.locator('.child-bump').click();
        await app.locator('.child-bump').click();
        await expect(app.locator('.child-count')).toHaveText('2');

        await app.locator('#toggle-child').click();
        await expect(app.locator('mx-counter-child')).toHaveCount(0);
        await expect(app.locator('.gone')).toHaveText('gone');

        await app.locator('#toggle-child').click();
        await expect(app.locator('mx-counter-child')).toHaveCount(1);
        await expect(app.locator('.child-count')).toHaveText('0');

        await app.locator('.child-bump').click();
        await expect(app.locator('.child-count')).toHaveText('1');

        expect(errors).toEqual([]);
    });
});
