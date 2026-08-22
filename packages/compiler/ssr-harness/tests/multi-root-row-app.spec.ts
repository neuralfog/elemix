import { expect, test } from '@playwright/test';

test.describe('MultiRootRowApp', () => {
    test('a list row with multiple roots (nested repeat + sibling) survives hydration', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));

        const response = await page.goto('/multi-root-row-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('end-g1');
        expect(served).toContain('end-g2');

        await page.waitForFunction(
            () => !!customElements.get('multi-root-row-app'),
        );

        const inner = page.locator('multi-root-row-app .inner');
        const tail = page.locator('multi-root-row-app .tail');

        await expect(inner).toHaveText(['a', 'b', 'c']);
        await expect(tail).toHaveText(['end-g1', 'end-g2']);

        await page.locator('multi-root-row-app .add').click();
        await expect(inner).toHaveText(['a', 'b', 'c', 'z']);
        await expect(tail).toHaveText(['end-g1', 'end-g2', 'end-g3']);

        expect(errors).toEqual([]);
    });
});
