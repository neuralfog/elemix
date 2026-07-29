import { expect, test } from '@playwright/test';

test.describe('FormApp', () => {
    test('form-associated child components + submit hydrate and produce FormData', async ({
        page,
    }) => {
        const response = await page.goto('/form-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('name="name"');
        expect(served).toContain('rating-input');
        expect(served).toContain('value="Ada"');

        await page.waitForFunction(
            () =>
                !!customElements.get('form-app') &&
                !!customElements.get('rating-input') &&
                !!customElements.get('submit-button'),
        );

        const root = page.locator('form-app');
        const stars = root.locator('rating-input .star');
        const nameInput = root.locator('input[name="name"]');
        const out = root.locator('.out');

        await expect(nameInput).toHaveValue('Ada');
        await expect(stars).toHaveCount(5);
        await expect(root.locator('rating-input .star.on')).toHaveCount(0);
        await expect(out).toHaveCount(0);

        await stars.nth(2).click();
        await expect(root.locator('rating-input .star.on')).toHaveCount(3);

        await root.locator('submit-button button').click();
        await expect(out).toHaveCount(1);
        await expect(out).toContainText('"name": "Ada"');
        await expect(out).toContainText('"rating": "3"');
    });
});
