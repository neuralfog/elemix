import { expect, test } from '@playwright/test';

test.describe('MultiRootApp', () => {
    test('a conditional branch with TWO root elements SSRs and hydrates; both survive re-render', async ({
        page,
    }) => {
        const response = await page.goto('/multi-root-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('multi-root-app');
        expect(served).toContain('class="a"');
        expect(served).toContain('class="b"');
        expect(served).toContain('>a0</div>');

        await page.waitForFunction(
            () => !!customElements.get('multi-root-app'),
        );

        const a = page.locator('multi-root-app .a');
        const b = page.locator('multi-root-app .b');
        const inc = page.locator('multi-root-app .inc');

        await expect(a).toHaveText('a0');
        await expect(b).toHaveText('b');

        await inc.click();
        await expect(a).toHaveText('a1');
        await expect(b).toHaveText('b');

        await inc.click();
        await expect(a).toHaveText('a2');
        await expect(b).toHaveText('b');
    });
});
