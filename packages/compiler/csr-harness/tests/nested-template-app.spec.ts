import { expect, test } from '@playwright/test';

test('nested-template-app: title and tag templates update in place', async ({
    page,
}) => {
    await page.goto('/view/nested-template-app');

    const h2 = page.locator('h2');
    await expect(h2).toHaveText('Dashboard');

    await expect(page.locator('.chip')).toHaveText(['new', 'new']);

    const buttons = page.locator('button');
    const titleButton = buttons.nth(0);
    const tagButton = buttons.nth(1);
    await expect(titleButton).toHaveText('change title');
    await expect(tagButton).toHaveText('change tag');

    const chipsHost = page.locator('.chips');
    await expect(chipsHost).toHaveText('new and again new');

    await titleButton.click();
    await expect(h2).toHaveText('Reports');

    await titleButton.click();
    await expect(h2).toHaveText('Dashboard');

    await tagButton.click();
    await expect(page.locator('.chip')).toHaveText(['hot', 'hot']);
    await expect(chipsHost).toHaveText('hot and again hot');

    await tagButton.click();
    await expect(page.locator('.chip')).toHaveText(['new', 'new']);
});
