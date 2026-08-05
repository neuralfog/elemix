import { expect, test } from '@playwright/test';

test.describe('DocumentPageApp', () => {
    test('a field-declared #document wraps the page in a full document and both hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/document-page-app');
        const html = (await response?.text()) ?? '';
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('</body></html>');
        expect(html).not.toContain('<slot></slot>');

        await page.waitForFunction(
            () =>
                !!customElements.get('document-page-app') &&
                !!customElements.get('document-chrome'),
        );

        await expect(page).toHaveTitle('Harness Document');
        await expect(page.locator('#chrome .bar')).toHaveText('Harness');

        const button = page.locator('document-page-app button');
        await expect(button).toHaveText('count is 0');

        await button.click();
        await expect(button).toHaveText('count is 1');
        await button.click();
        await expect(button).toHaveText('count is 2');
    });
});
