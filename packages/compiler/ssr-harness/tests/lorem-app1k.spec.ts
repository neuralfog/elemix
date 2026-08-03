import { expect, test } from '@playwright/test';

test.describe('LoremApp1k', () => {
    test('a paragraph repeated 1000 times renders server-side and hydrates', async ({
        page,
    }) => {
        const response = await page.goto('/lorem-app1k');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('0: Lorem ipsum dolor sit amet');
        expect(served).toContain('999: Lorem ipsum dolor sit amet');

        await page.waitForFunction(() => customElements.get('lorem-app1k'));

        const paras = page.locator('lorem-app1k .para');
        await expect(paras).toHaveCount(1000);
        await expect(paras.first()).toContainText('0: Lorem ipsum');
        await expect(paras.last()).toContainText('999: Lorem ipsum');
    });
});
