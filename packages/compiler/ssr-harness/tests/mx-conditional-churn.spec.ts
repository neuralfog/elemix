import { expect, test } from '@playwright/test';

test.describe('MxConditionalChurn (empty/null branch churn, hydration)', () => {
    test('empty and null branches churn and track live value after hydrate', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('/mx-conditional-churn');
        await page.waitForFunction(
            () => !!customElements.get('mx-conditional-churn'),
            undefined,
            { timeout: 10_000 },
        );
        const app = page.locator('mx-conditional-churn');
        await expect(app.locator('.e-on')).toHaveText('e0');
        await expect(app.locator('.n-on')).toHaveText('n0');

        await app.locator('#tick').click();
        await expect(app.locator('.count')).toHaveText('1');
        await expect(app.locator('.e-on')).toHaveText('e1');
        await expect(app.locator('.n-on')).toHaveText('n1');

        await app.locator('#toggle-empty').click();
        await expect(app.locator('.e-on')).toHaveCount(0);
        await app.locator('#toggle-empty').click();
        await expect(app.locator('.e-on')).toHaveText('e1');

        await app.locator('#toggle-null').click();
        await expect(app.locator('.n-on')).toHaveCount(0);
        await app.locator('#toggle-null').click();
        await expect(app.locator('.n-on')).toHaveText('n1');

        await app.locator('#toggle-empty').click();
        await expect(app.locator('.e-on')).toHaveCount(0);
        await app.locator('#tick').click();
        await app.locator('#toggle-empty').click();
        await expect(app.locator('.e-on')).toHaveText('e2');
        await expect(app.locator('.n-on')).toHaveText('n2');

        expect(errors).toEqual([]);
    });
});
