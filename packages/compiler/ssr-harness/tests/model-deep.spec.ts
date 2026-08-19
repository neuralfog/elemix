import { expect, test } from '@playwright/test';

test.describe('ModelDeepApp', () => {
    test('a root ref forwarded 3 levels deep stays two-way reactive', async ({
        page,
    }) => {
        const response = await page.goto('/model-deep-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Hello, Ada');
        expect(served).toContain('value="Ada"');

        await page.waitForFunction(
            () => !!customElements.get('model-deep-app'),
        );
        await page.waitForFunction(
            () => !!customElements.get('model-deep-inner'),
        );

        // input lives 3 shadow levels below the root: outer > middle > inner
        const input = page.locator('model-deep-app input').first();
        const out = page.locator('model-deep-app .out').first();

        await expect(input).toHaveValue('Ada');
        await expect(out).toHaveText('Hello, Ada');

        // focus (not click) to avoid WebKit hit-testing through nested shadow roots
        await input.focus();
        await input.press('End');
        await input.pressSequentially(' Lovelace');

        await expect(input).toHaveValue('Ada Lovelace');
        await expect(out).toHaveText('Hello, Ada Lovelace');
    });
});
