import { expect, test } from '@playwright/test';

test('panel-app: rename toggles heading, add increments stat', async ({
    page,
}) => {
    await page.goto('/view/panel-app');

    const heading = page.locator('h2');
    const stat = page.locator('.stat');
    const buttons = page.locator('button');
    const addBtn = buttons.nth(0);
    const renameBtn = buttons.nth(1);

    await expect(addBtn).toHaveText('add');
    await expect(renameBtn).toHaveText('rename');
    await expect(heading).toHaveText('Inbox');
    await expect(stat).toHaveText('3 open');

    await renameBtn.click();
    await expect(heading).toHaveText('Archive');
    await expect(stat).toHaveText('3 open');

    await renameBtn.click();
    await expect(heading).toHaveText('Inbox');

    await addBtn.click();
    await expect(stat).toHaveText('4 open');
    await addBtn.click();
    await addBtn.click();
    await expect(stat).toHaveText('6 open');
    await expect(heading).toHaveText('Inbox');

    await renameBtn.click();
    await expect(heading).toHaveText('Archive');
    await expect(stat).toHaveText('6 open');
    await addBtn.click();
    await expect(stat).toHaveText('7 open');
    await expect(heading).toHaveText('Archive');
});
