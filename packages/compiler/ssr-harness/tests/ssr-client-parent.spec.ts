import { expect, test } from '@playwright/test';

test.describe('SsrClientParent', () => {
    test('#client parent renders nothing server-side; its normal #component child is forced to render client-side too; both mount fresh and stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-client-parent');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<ssr-client-parent>');
        expect(served).not.toContain('shadowrootmode');
        expect(served).not.toContain('class="parent"');
        expect(served).not.toContain('class="child"');
        expect(served).not.toContain('<ssr-client-parent-child');

        await page.waitForFunction(
            () =>
                !!customElements.get('ssr-client-parent') &&
                !!customElements.get('ssr-client-parent-child'),
        );

        const pn = page.locator('ssr-client-parent .pn');
        const fromParent = page.locator('ssr-client-parent .from-parent');
        const local = page.locator('ssr-client-parent .local');

        await expect(pn).toHaveText('0');
        await expect(fromParent).toHaveText('0');
        await expect(local).toHaveText('0');

        await page.locator('ssr-client-parent .parent .inc').click();
        await expect(pn).toHaveText('1');
        await expect(fromParent).toHaveText('1');
        await page.locator('ssr-client-parent .parent .inc').click();
        await expect(pn).toHaveText('2');
        await expect(fromParent).toHaveText('2');

        await page.locator('ssr-client-parent .child .tick').click();
        await expect(local).toHaveText('1');
        await expect(fromParent).toHaveText('2');
    });
});
