import { expect, test } from '@playwright/test';

test('verbs-panel-app: bare sibling holes returning templates (arrow fn + method) render and swap in CSR', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/view/verbs-panel-app');

    const root = page.locator('verbs-panel-app');
    await expect(root.locator('pre.cell')).toHaveCount(0);
    await expect(root.locator('pre.row')).toHaveCount(0);
    await expect(root.locator('.busy')).toHaveCount(0);

    await root.locator('.toggle').click();
    await expect(root.locator('pre.cell')).toHaveCount(2);
    await expect(root.locator('pre.row')).toHaveCount(2);
    await expect(root.locator('pre.cell').first()).toHaveText('POST');
    await expect(root.locator('pre.row').first()).toHaveText('GET');
    await expect(root.locator('.busy')).toHaveText('busy');

    await root.locator('.toggle').click();
    await expect(root.locator('pre.cell')).toHaveCount(0);
    await expect(root.locator('pre.row')).toHaveCount(0);

    expect(errors).toEqual([]);
});
