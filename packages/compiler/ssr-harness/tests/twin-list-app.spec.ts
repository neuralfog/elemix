import { expect, test } from '@playwright/test';

test.describe('TwinListApp', () => {
    test('two sibling list regions in one parent survive hydration', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));

        const response = await page.goto('/twin-list-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="left"');
        expect(served).toContain('class="right"');

        await page.waitForFunction(() => !!customElements.get('twin-list-app'));

        const left = page.locator('twin-list-app .left');
        const right = page.locator('twin-list-app .right');

        await expect(left).toHaveText(['a', 'b', 'c']);
        await expect(right).toHaveText(['x', 'y']);

        await page.locator('twin-list-app .add-left').click();
        await expect(left).toHaveText(['a', 'b', 'c', 'l3']);
        await expect(right).toHaveText(['x', 'y']);

        await page.locator('twin-list-app .add-right').click();
        await expect(left).toHaveText(['a', 'b', 'c', 'l3']);
        await expect(right).toHaveText(['x', 'y', 'r2']);

        expect(errors).toEqual([]);
    });
});
