import { expect, test } from '@playwright/test';

test.describe('PrimitiveStateApp', () => {
    test('bare primitive #state fields (number/boolean/string) each hydrate as an independent reactive slice', async ({
        page,
    }) => {
        const response = await page.goto('/primitive-state-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('primitive-state-app');
        expect(served).toContain('>0</span>');
        expect(served).toContain('>on</span>');
        expect(served).toContain('>idle</strong>');

        await page.waitForFunction(
            () => !!customElements.get('primitive-state-app'),
        );

        const count = page.locator('primitive-state-app .count');
        const active = page.locator('primitive-state-app .active');
        const label = page.locator('primitive-state-app .label');
        const incBtn = page.locator('primitive-state-app button').nth(0);
        const resetBtn = page.locator('primitive-state-app button').nth(1);
        const toggleBtn = page.locator('primitive-state-app button').nth(2);
        const renameBtn = page.locator('primitive-state-app button').nth(3);

        await expect(count).toHaveText('0');
        await expect(active).toHaveText('on');
        await expect(label).toHaveText('idle');

        await incBtn.click();
        await incBtn.click();
        await expect(count).toHaveText('2');
        await expect(active).toHaveText('on');
        await expect(label).toHaveText('idle');

        await toggleBtn.click();
        await expect(active).toHaveText('off');
        await expect(count).toHaveText('2');

        await renameBtn.click();
        await expect(label).toHaveText('busy');
        await expect(count).toHaveText('2');
        await expect(active).toHaveText('off');

        await resetBtn.click();
        await expect(count).toHaveText('0');
        await expect(active).toHaveText('off');
        await expect(label).toHaveText('busy');

        await incBtn.click();
        await expect(count).toHaveText('1');
    });
});
