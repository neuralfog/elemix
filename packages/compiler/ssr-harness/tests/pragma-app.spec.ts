import { expect, test } from '@playwright/test';

test.describe('PragmaApp', () => {
    test('minimal #component/#styles/#state hydrates a single text hole', async ({
        page,
    }) => {
        const response = await page.goto('/pragma-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('pragma-app');
        expect(served).toContain('shadowrootmode');
        expect(served).toContain('>hello</span>');

        await page.waitForFunction(() => !!customElements.get('pragma-app'));

        const label = page.locator('pragma-app .label');
        await expect(label).toHaveText('hello');
    });
});
