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

test('view-data-rich-app: renders every viewData shape', async ({ page }) => {
    await seedViewData(page, {
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        tags: ['a', 'b', 'c'],
        scores: [1, 2, 3, 4],
        obj: { a: 'x', b: 7 },
        nested: { deep: { value: 'buried' } },
        rows: [
            { id: 1, label: 'one' },
            { id: 2, label: 'two' },
        ],
    });
    await page.goto('/view/view-data-rich-app');

    const app = page.locator('view-data-rich-app');
    await expect(app.locator('.str')).toHaveText('hello');
    await expect(app.locator('.num')).toHaveText('42');
    await expect(app.locator('.bool')).toHaveText('yes');
    await expect(app.locator('.nil')).toHaveText('none');
    await expect(app.locator('.tags')).toHaveText('a,b,c');
    await expect(app.locator('.scores-len')).toHaveText('4');
    await expect(app.locator('.scores-sum')).toHaveText('10');
    await expect(app.locator('.obj-a')).toHaveText('x');
    await expect(app.locator('.obj-b')).toHaveText('7');
    await expect(app.locator('.deep')).toHaveText('buried');

    await expect(app.locator('.rows .row')).toHaveText(['1:one', '2:two']);
});
