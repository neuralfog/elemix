import { expect, test } from '@playwright/test';

test.describe('MxListOfComponents (keyed component list, hydration)', () => {
    test('child state follows its key across reorder/swap/remove after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-list-of-components');
        await page.waitForFunction(
            () => !!customElements.get('mx-list-of-components'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-list-of-components');
        await expect(app.locator('mx-counter-child')).toHaveCount(3);

        const y = app.locator('mx-counter-child[data-id="2"]');
        await y.locator('.child-bump').click();
        await y.locator('.child-bump').click();
        await expect(y.locator('.child-count')).toHaveText('2');

        await app.locator('#reverse').click();
        await expect(app.locator('mx-counter-child').first()).toHaveAttribute(
            'data-id',
            '3',
        );
        await expect(
            app.locator('mx-counter-child[data-id="2"] .child-count'),
        ).toHaveText('2');

        await app.locator('#swap').click();
        await expect(
            app.locator('mx-counter-child[data-id="2"] .child-count'),
        ).toHaveText('2');

        await app.locator('#remove-middle').click();
        await expect(app.locator('mx-counter-child')).toHaveCount(2);

        await app.locator('#clear').click();
        await expect(app.locator('mx-counter-child')).toHaveCount(0);

        expect(errors).toEqual([]);
    });
});
