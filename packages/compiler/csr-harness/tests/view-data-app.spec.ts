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

test('view-data-app: threads viewData through nested components', async ({
    page,
}) => {
    await seedViewData(page, {
        title: 'Hello viewData',
        user: { name: 'Ada' },
        count: 3,
    });
    await page.goto('/view/view-data-app');

    const app = page.locator('view-data-app');
    await expect(app.locator('.title')).toHaveText('Hello viewData');
    await expect(app.locator('view-data-mid .count')).toHaveText('3');
    await expect(app.locator('view-data-leaf .leaf-name')).toHaveText('Ada');
});
