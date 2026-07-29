import { expect, test } from '@playwright/test';

test.describe('ViewDataApp', () => {
    test('viewData passed to Reply.view is readable via this.viewData at every depth, server-rendered and preserved on the client', async ({
        page,
    }) => {
        const response = await page.goto('/view-data-app');
        const served = (await response?.text()) ?? '';
        // read at the root, mid, and deep leaf, all server-rendered from viewData
        expect(served).toContain('class="title">Hello viewData</h1>');
        expect(served).toContain('class="count">3</span>');
        expect(served).toContain('class="leaf-name">Ada</span>');
        // the value is shipped to the client, not re-fetched
        expect(served).toContain('window.__elemix_vd=');

        await page.waitForFunction(
            () =>
                !!customElements.get('view-data-app') &&
                !!customElements.get('view-data-mid') &&
                !!customElements.get('view-data-leaf'),
        );

        // survives hydration at every depth
        await expect(page.locator('view-data-app .title')).toHaveText(
            'Hello viewData',
        );
        await expect(page.locator('view-data-app .count')).toHaveText('3');
        await expect(page.locator('view-data-app .leaf-name')).toHaveText(
            'Ada',
        );
    });
});
