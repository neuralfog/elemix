import { expect, test } from '@playwright/test';

test.describe('SsrStoreApp', () => {
    test('SSR parent + #client child share a live object prop across the boundary; child mutates, parent follows', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-store-app');
        const served = (await response?.text()) ?? '';
        // parent readout is server-rendered
        expect(served).toContain('<strong>0</strong>');
        // the #client child is a bare tag - none of its content rendered server-side
        expect(served).toContain('<ssr-store-controls');
        expect(served).not.toContain('Child controls');
        expect(served).not.toContain('class="value"');

        await page.waitForFunction(
            () =>
                !!customElements.get('ssr-store-app') &&
                !!customElements.get('ssr-store-controls'),
        );

        const readout = page.locator('ssr-store-app .readout strong');
        const childValue = page.locator(
            'ssr-store-app ssr-store-controls .value',
        );
        const dec = page.locator('ssr-store-app ssr-store-controls .dec');
        const inc = page.locator('ssr-store-app ssr-store-controls .inc');

        // child mounted fresh client-side (label now present); both read 0
        await expect(
            page.locator('ssr-store-app ssr-store-controls .label'),
        ).toHaveText('Child controls');
        await expect(readout).toHaveText('0');
        await expect(childValue).toHaveText('0');

        // child mutates the LIVE shared object -> parent readout follows
        await inc.click();
        await expect(childValue).toHaveText('1');
        await expect(readout).toHaveText('1');

        await inc.click();
        await inc.click();
        await expect(childValue).toHaveText('3');
        await expect(readout).toHaveText('3');

        await dec.click();
        await expect(childValue).toHaveText('2');
        await expect(readout).toHaveText('2');

        await dec.click();
        await dec.click();
        await dec.click();
        await expect(childValue).toHaveText('-1');
        await expect(readout).toHaveText('-1');
    });
});
