import { expect, test } from '@playwright/test';

test.describe('structural hole as sibling of a text hole (bounds/span)', () => {
    test('conditional sibling of a text hole mounts in the right place and toggles', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        const response = await page.goto('/structural-sibling-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Label: A');
        expect(served).toContain('<b class="flag">x</b>');

        await page.waitForFunction(
            () => !!customElements.get('structural-sibling-app'),
        );
        const host = page.locator('structural-sibling-app');
        await expect(host.locator('b.flag')).toHaveCount(1);
        await expect(host.locator('b.flag')).toHaveText('x');

        await host.locator('button').click();
        await expect(host.locator('b.flag')).toHaveCount(0);

        await host.locator('button').click();
        await expect(host.locator('b.flag')).toHaveCount(1);

        expect(errors).toEqual([]);
    });
});
