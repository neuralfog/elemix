import { expect, test } from '@playwright/test';

test.describe('NullGuardApp (conditional reactive deref)', () => {
    test('an inline data-guarded hole survives data flipping to null', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/null-guard-app');
        await page.waitForFunction(
            () => !!customElements.get('null-guard-app'),
            undefined,
            { timeout: 10_000 },
        );
        const root = page.locator('null-guard-app');
        await expect(root.locator('.val')).toHaveText('first');

        await root.locator('#toggle').click();
        await expect(root.locator('.empty')).toHaveText('empty');
        await expect(root.locator('.val')).toHaveCount(0);

        await root.locator('#toggle').click();
        await expect(root.locator('.val')).toHaveText('again');

        expect(errors).toEqual([]);
    });
});
