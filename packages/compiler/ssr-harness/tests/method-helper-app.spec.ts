import { expect, test } from '@playwright/test';

test.describe('MethodHelperApp', () => {
    test('nested tpl helpers inline at top level and inside a ternary branch; reactive + branch swap', async ({
        page,
    }) => {
        const response = await page.goto('/method-helper-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('method-helper-app');
        expect(served).toContain('class="chip"');
        expect(served).toContain('class="open"');

        await page.waitForFunction(
            () => !!customElements.get('method-helper-app'),
        );

        const rowChips = page.locator('method-helper-app .row .chip');
        const openChip = page.locator('method-helper-app .open .chip');
        const count = page.locator('method-helper-app .count');
        const toggle = page.locator('method-helper-app .toggle');
        const inc = page.locator('method-helper-app .inc');

        await expect(rowChips).toHaveText(['a', 'b']);
        await expect(openChip).toHaveText('open');
        await expect(count).toHaveText('0');

        await inc.click();
        await expect(count).toHaveText('1');

        await toggle.click();
        await expect(page.locator('method-helper-app .closed')).toHaveText(
            'closed',
        );
        await expect(page.locator('method-helper-app .open')).toHaveCount(0);
        await expect(rowChips).toHaveText(['a', 'b']);

        await toggle.click();
        await expect(page.locator('method-helper-app .open .chip')).toHaveText(
            'open',
        );
        await expect(page.locator('method-helper-app .count')).toHaveText('1');
    });
});
