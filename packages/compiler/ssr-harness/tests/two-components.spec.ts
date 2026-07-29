import { expect, test } from '@playwright/test';

test.describe('TwoComponents', () => {
    test('two components defined in one file both compile + register from a single bundle; the rendered one hydrates', async ({
        page,
    }) => {
        const response = await page.goto('/two-components');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<first-widget');
        expect(served).toContain('>1</button>');

        await page.waitForFunction(
            () =>
                !!customElements.get('first-widget') &&
                !!customElements.get('second-widget'),
        );

        const first = page.locator('first-widget .first');
        await expect(first).toHaveText('1');
        await first.click();
        await expect(first).toHaveText('2');
        await first.click();
        await expect(first).toHaveText('3');
    });
});
