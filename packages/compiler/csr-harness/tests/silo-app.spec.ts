import { expect, test } from '@playwright/test';

test('silo-app: shallow list trigger, per-cell update, reassign, scalar', async ({
    page,
}) => {
    await page.goto('/view/silo-app');
    await page.waitForFunction(() => !!customElements.get('silo-app'));

    const count = page.locator('silo-app .count');
    const labels = page.locator('silo-app ul.rows li.row .rlabel');
    const ids = page.locator('silo-app ul.rows li.row .rid');
    const append = page.locator('silo-app .append');
    const remove = page.locator('silo-app .remove');
    const bump = page.locator('silo-app .bump');
    const reset = page.locator('silo-app .reset');
    const inc = page.locator('silo-app .inc');

    await expect(count).toHaveText('0');
    await expect(labels).toHaveText(['alpha', 'beta']);
    await expect(ids).toHaveText(['1', '2']);

    await append.click();
    await expect(labels).toHaveText(['alpha', 'beta', 'gamma']);
    await expect(ids).toHaveText(['1', '2', '3']);

    await bump.click();
    await bump.click();
    await expect(labels).toHaveText(['alpha!!', 'beta', 'gamma']);

    await remove.click();
    await expect(labels).toHaveText(['beta', 'gamma']);
    await expect(ids).toHaveText(['2', '3']);

    await inc.click();
    await inc.click();
    await expect(count).toHaveText('2');
    await expect(labels).toHaveText(['beta', 'gamma']);

    await reset.click();
    await expect(labels).toHaveText(['alpha', 'beta']);
    await expect(ids).toHaveText(['1', '2']);
    await expect(count).toHaveText('2');
});
