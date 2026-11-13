import { expect, test } from '@playwright/test';

test.describe('MxSiblingHoles (adjacent holes, hydration)', () => {
    test('adjacent holes keep position as each goes null after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-sibling-holes');
        await page.waitForFunction(
            () => !!customElements.get('mx-sibling-holes'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-sibling-holes');
        await expect(app.locator('.holes')).toHaveText('[ A B C ]');

        await app.locator('#toggle-b').click();
        await expect(app.locator('.b')).toHaveCount(0);
        await expect(app.locator('.holes')).toHaveText('[ A C ]');

        await app.locator('#toggle-a').click();
        await expect(app.locator('.holes')).toHaveText('[ C ]');

        await app.locator('#toggle-c').click();
        await expect(app.locator('.hole')).toHaveCount(0);
        await expect(app.locator('.holes')).toHaveText('[ ]');

        await app.locator('#toggle-a').click();
        await app.locator('#toggle-b').click();
        await app.locator('#toggle-c').click();
        await expect(app.locator('.holes')).toHaveText('[ A B C ]');

        expect(errors).toEqual([]);
    });
});
