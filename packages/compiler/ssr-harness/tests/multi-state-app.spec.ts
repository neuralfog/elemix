import { expect, test } from '@playwright/test';

test.describe('MultiStateApp', () => {
    test('two independent #state slices hydrate and update without cross-talk', async ({
        page,
    }) => {
        const response = await page.goto('/multi-state-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('multi-state-app');
        expect(served).toContain('>0</span>');
        expect(served).toContain('>Ada</strong>');
        expect(served).toContain('>online</span>');

        await page.waitForFunction(
            () => !!customElements.get('multi-state-app'),
        );

        const count = page.locator('multi-state-app .count');
        const name = page.locator('multi-state-app .name');
        const status = page.locator('multi-state-app .status');
        const buttons = page.locator('multi-state-app button');
        const incBtn = buttons.nth(0);
        const resetBtn = buttons.nth(1);
        const toggleBtn = buttons.nth(2);
        const renameBtn = buttons.nth(3);

        await expect(incBtn).toHaveText('+1');
        await expect(resetBtn).toHaveText('reset');
        await expect(toggleBtn).toHaveText('toggle status');
        await expect(renameBtn).toHaveText('rename');

        await expect(count).toHaveText('0');
        await expect(name).toHaveText('Ada');
        await expect(status).toHaveText('online');

        await incBtn.click();
        await incBtn.click();
        await incBtn.click();
        await expect(count).toHaveText('3');
        await expect(name).toHaveText('Ada');
        await expect(status).toHaveText('online');

        await resetBtn.click();
        await expect(count).toHaveText('0');
        await expect(name).toHaveText('Ada');

        await incBtn.click();
        await expect(count).toHaveText('1');

        await toggleBtn.click();
        await expect(status).toHaveText('offline');
        await expect(count).toHaveText('1');
        await toggleBtn.click();
        await expect(status).toHaveText('online');

        await renameBtn.click();
        await expect(name).toHaveText('Grace');
        await expect(count).toHaveText('1');
        await expect(status).toHaveText('online');
        await renameBtn.click();
        await expect(name).toHaveText('Ada');
    });
});
