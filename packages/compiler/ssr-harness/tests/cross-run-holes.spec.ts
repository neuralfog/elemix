import { expect, test } from '@playwright/test';

test.describe('cross-run text holes (hydration splitRun)', () => {
    test('two text holes split by a static element hydrate without crashing and stay reactive', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        const response = await page.goto('/cross-run-holes-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<span class="mid">|</span>');

        await page.waitForFunction(
            () => !!customElements.get('cross-run-holes-app'),
        );
        const pair = page.locator('cross-run-holes-app .pair');
        await expect(pair).toHaveText('A|B');

        await page.locator('cross-run-holes-app button').click();
        await expect(pair).toHaveText('X|Y');

        expect(errors).toEqual([]);
    });
});
