import { expect, test } from '@playwright/test';

test.describe('MxHoleInHole (nested dynamic holes, hydration)', () => {
    test('inner flips under outer, outer drop clears inner, mutate survives after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-hole-in-hole');
        await page.waitForFunction(
            () => !!customElements.get('mx-hole-in-hole'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-hole-in-hole');
        await expect(app.locator('.o-label')).toHaveText('o');
        await expect(app.locator('.inner')).toHaveText('i1');

        await app.locator('#toggle-inner').click();
        await expect(app.locator('.inner')).toHaveCount(0);
        await expect(app.locator('.outer')).toHaveCount(1);

        await app.locator('#toggle-inner').click();
        await expect(app.locator('.inner')).toHaveText('i1');

        await app.locator('#bump').click();
        await expect(app.locator('.inner')).toHaveText('i2');

        await app.locator('#toggle-outer').click();
        await expect(app.locator('.outer')).toHaveCount(0);
        await expect(app.locator('.inner')).toHaveCount(0);

        await app.locator('#toggle-outer').click();
        await expect(app.locator('.outer')).toHaveCount(1);
        await expect(app.locator('.inner')).toHaveText('i2');

        expect(errors).toEqual([]);
    });
});
