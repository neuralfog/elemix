import { expect, test } from '@playwright/test';

test.describe('emoji static prefix between two text holes (splitRun UTF-16)', () => {
    test('a non-BMP static segment does not corrupt the following hole on hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        await page.goto('/emoji-prefix-app');
        await page.waitForFunction(
            () => !!customElements.get('emoji-prefix-app'),
        );
        const e = page.locator('emoji-prefix-app .e');
        await expect(e).toHaveText('A🎉B');

        await page.locator('emoji-prefix-app button').click();
        await expect(e).toHaveText('X🎉Y');

        expect(errors).toEqual([]);
    });
});
