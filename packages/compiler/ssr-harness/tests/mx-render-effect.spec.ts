import { expect, test } from '@playwright/test';

test('mx-render-effect: after hydration render() repaints view but does not fire #effect', async ({
    page,
}) => {
    await page.goto('/mx-render-effect');
    await page.waitForFunction(() => !!customElements.get('mx-render-effect'));
    const root = page.locator('mx-render-effect');
    await expect(root.locator('.runs')).toHaveText('1');
    await expect(root.locator('.label')).toHaveText('a');

    await root.locator('button.paint').click();
    await expect(root.locator('.label')).toHaveText('a!');
    await expect(root.locator('.runs')).toHaveText('1');

    await root.locator('button.bump').click();
    await expect(root.locator('.runs')).toHaveText('2');
});
