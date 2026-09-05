import { expect, type Page, test } from '@playwright/test';

const seedViewData = async (page: Page, data: unknown): Promise<void> => {
    await page.route('**/view/*', async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace(
            '</head>',
            `<script type="application/json" id="__elemix_vd">${JSON.stringify(
                data,
            )}</script></head>`,
        );
        await route.fulfill({ response, body: html });
    });
};

test('view-data-store-app: seeds the store from viewData and increments', async ({
    page,
}) => {
    await seedViewData(page, { start: 5 });
    await page.goto('/view/view-data-store-app');

    const app = page.locator('view-data-store-app');
    const count = app.locator('.count');
    const inc = app.locator('.inc');

    await expect(count).toHaveText('5');
    await inc.click();
    await expect(count).toHaveText('6');
    await inc.click();
    await expect(count).toHaveText('7');
});
