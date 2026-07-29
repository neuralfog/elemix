import { expect, test } from '@playwright/test';

test.describe('PanelApp', () => {
    test('two helper-method sub-templates SSR and stay independently reactive', async ({
        page,
    }) => {
        const response = await page.goto('/panel-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('panel-app');
        expect(served).toContain('<h2>Inbox</h2>');
        expect(served).toContain('3 open');

        await page.waitForFunction(() => !!customElements.get('panel-app'));

        const heading = page.locator('panel-app h2');
        const stat = page.locator('panel-app .stat');
        const addBtn = page.locator('panel-app button').nth(0);
        const renameBtn = page.locator('panel-app button').nth(1);

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
});
