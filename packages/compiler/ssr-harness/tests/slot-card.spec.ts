import { expect, test } from '@playwright/test';

test.describe('SlotCard', () => {
    test('deep slot nesting (card > item > panel > chips) SSRs and survives hydration', async ({
        page,
    }) => {
        await page.goto('/slot-card');
        await page.waitForFunction(
            () =>
                !!customElements.get('slot-card') &&
                !!customElements.get('slot-item') &&
                !!customElements.get('slot-panel') &&
                !!customElements.get('slot-chip'),
        );

        await expect(page.locator('slot-card slot-item')).toHaveCount(2);
        await expect(
            page.locator('slot-card slot-item slot-panel'),
        ).toHaveCount(2);
        await expect(
            page.locator('slot-card slot-item slot-panel slot-chip'),
        ).toHaveCount(6);

        await expect(page.locator('slot-item .item h3')).toHaveText([
            'Group One',
            'Group Two',
        ]);

        await expect(page.locator('slot-chip .chip')).toHaveText([
            'Alpha',
            'Beta',
            'Gamma',
            'Delta',
            'Epsilon',
            'Zeta',
        ]);
    });
});
