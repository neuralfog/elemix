import { expect, test } from '@playwright/test';

test.describe('NestedApp', () => {
    test('nested keyed repeat SSRs both levels and patches only the touched inner list', async ({
        page,
    }) => {
        const response = await page.goto('/nested-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('nested-app');
        expect(served).toContain('Fruit');
        expect(served).toContain('Vegetables');
        expect(served).toContain('<li>Apple</li>');
        expect(served).toContain('<li>Banana</li>');
        expect(served).toContain('<li>Carrot</li>');

        await page.waitForFunction(() => !!customElements.get('nested-app'));

        const categories = page.locator('nested-app .category');
        const fruit = categories.nth(0);
        const veg = categories.nth(1);
        const fruitItems = fruit.locator('ul li');
        const vegItems = veg.locator('ul li');

        await expect(categories).toHaveCount(2);
        await expect(fruit.locator('.head strong')).toHaveText('Fruit');
        await expect(veg.locator('.head strong')).toHaveText('Vegetables');
        await expect(fruitItems).toHaveText(['Apple', 'Banana']);
        await expect(vegItems).toHaveText(['Carrot']);

        const fruitAdd = fruit.locator('.head button');
        const vegAdd = veg.locator('.head button');
        await expect(fruitAdd).toHaveText('+ item');

        await fruitAdd.click();
        await expect(fruitItems).toHaveText(['Apple', 'Banana', 'New item']);
        await expect(vegItems).toHaveText(['Carrot']);

        await fruitAdd.click();
        await expect(fruitItems).toHaveText([
            'Apple',
            'Banana',
            'New item',
            'New item',
        ]);
        await expect(vegItems).toHaveText(['Carrot']);

        await vegAdd.click();
        await expect(vegItems).toHaveText(['Carrot', 'New item']);
        await expect(fruitItems).toHaveText([
            'Apple',
            'Banana',
            'New item',
            'New item',
        ]);
    });
});
