import { expect, test } from '@playwright/test';

test.describe('InterpApp', () => {
    test('markerless split of adjacent + mixed static/dynamic text holes; reactive', async ({
        page,
    }) => {
        const response = await page.goto('/interp-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="full" data-t="3,8"');
        expect(served).toContain('full:</span> AdaLovelace</p>');
        expect(served).toContain('dash:</span> Ada-Lovelace</p>');
        expect(served).toContain('class="middle" data-t="0"');
        expect(served).toContain('middle:</span> []</p>');
        expect(served).toContain('num:</span> 0</p>');

        await page.waitForFunction(() => !!customElements.get('interp-app'));

        const full = page.locator('interp-app .full');
        const dash = page.locator('interp-app .dash');
        const middle = page.locator('interp-app .middle');
        const num = page.locator('interp-app .num');
        const swapBtn = page.locator('interp-app button').nth(0);
        const setMiddleBtn = page.locator('interp-app button').nth(1);
        const incBtn = page.locator('interp-app button').nth(2);

        await expect(full).toHaveText('full: AdaLovelace');
        await expect(dash).toHaveText('dash: Ada-Lovelace');
        await expect(middle).toHaveText('middle: []');
        await expect(num).toHaveText('num: 0');

        await incBtn.click();
        await expect(num).toHaveText('num: 1');
        await incBtn.click();
        await expect(num).toHaveText('num: 2');

        await setMiddleBtn.click();
        await expect(middle).toHaveText('middle: [M]');
        await setMiddleBtn.click();
        await expect(middle).toHaveText('middle: []');

        await swapBtn.click();
        await expect(full).toHaveText('full: LovelaceAda');
        await expect(dash).toHaveText('dash: Lovelace-Ada');

        await swapBtn.click();
        await expect(full).toHaveText('full: AdaLovelace');
        await expect(dash).toHaveText('dash: Ada-Lovelace');

        await expect(num).toHaveText('num: 2');
    });
});
