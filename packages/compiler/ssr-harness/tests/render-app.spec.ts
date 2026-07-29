import { expect, test } from '@playwright/test';

test.describe('RenderApp', () => {
    test('plain (non-reactive) field only flushes to the DOM via the manual render() escape hatch', async ({
        page,
    }) => {
        const response = await page.goto('/render-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('render-app');
        expect(served).toContain('>0</div>');

        await page.waitForFunction(() => !!customElements.get('render-app'));

        const value = page.locator('render-app .value');
        const silent = page.locator('render-app .ghost');
        const withRender = page.locator('render-app button').nth(1);

        await expect(silent).toHaveText('Increment (silent)');
        await expect(withRender).toHaveText('Increment + render()');
        await expect(value).toHaveText('0');

        await silent.click();
        await silent.click();
        await silent.click();
        await expect(value).toHaveText('0');

        await withRender.click();
        await expect(value).toHaveText('4');

        await silent.click();
        await silent.click();
        await expect(value).toHaveText('4');

        await withRender.click();
        await expect(value).toHaveText('7');
    });
});
