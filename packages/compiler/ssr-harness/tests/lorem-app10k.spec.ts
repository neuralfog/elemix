import { expect, test } from '@playwright/test';

test.describe('LoremApp10k', () => {
    test('a paragraph repeated 10000 times renders server-side and hydrates', async ({
        page,
    }) => {
        const response = await page.goto('/lorem-app10k');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('0: Lorem ipsum dolor sit amet');
        expect(served).toContain('9999: Lorem ipsum dolor sit amet');

        await page.waitForFunction(() => customElements.get('lorem-app10k'));

        const paras = page.locator('lorem-app10k .para');
        await expect(paras).toHaveCount(10000);
        await expect(paras.first()).toContainText('0: Lorem ipsum');
        await expect(paras.last()).toContainText('9999: Lorem ipsum');
    });
});
