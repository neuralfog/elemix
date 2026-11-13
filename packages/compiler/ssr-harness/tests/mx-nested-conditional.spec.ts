import { expect, test } from '@playwright/test';

test.describe('MxNestedConditional (nested conditional, hydration)', () => {
    test('inner flips under outer and outer drop disposes inner after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-nested-conditional');
        await page.waitForFunction(
            () => !!customElements.get('mx-nested-conditional'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-nested-conditional');
        await expect(app.locator('.inner-on')).toHaveText('inner-on');

        await app.locator('#toggle-inner').click();
        await expect(app.locator('.inner-off')).toHaveText('inner-off');
        await expect(app.locator('.inner-on')).toHaveCount(0);
        await expect(app.locator('.outer-on')).toBeVisible();

        await app.locator('#toggle-inner').click();
        await expect(app.locator('.inner-on')).toHaveText('inner-on');

        await app.locator('#toggle-outer').click();
        await expect(app.locator('.outer-off')).toHaveText('outer-off');
        await expect(app.locator('.outer-on')).toHaveCount(0);
        await expect(app.locator('.inner-on')).toHaveCount(0);

        await app.locator('#toggle-outer').click();
        await expect(app.locator('.outer-on')).toBeVisible();
        await expect(app.locator('.inner-on')).toHaveText('inner-on');

        await app.locator('#toggle-inner').click();
        await app.locator('#toggle-outer').click();
        await app.locator('#toggle-outer').click();
        await expect(app.locator('.inner-off')).toHaveText('inner-off');

        expect(errors).toEqual([]);
    });
});
