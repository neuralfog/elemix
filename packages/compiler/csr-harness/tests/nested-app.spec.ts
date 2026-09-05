import { expect, test } from '@playwright/test';

test('nested-app: per-category add appends items independently', async ({
    page,
}) => {
    await page.goto('/view/nested-app');

    const categories = page.locator('.category');
    await expect(categories).toHaveCount(2);

    const fruit = categories.nth(0);
    const veg = categories.nth(1);

    await expect(fruit.locator('.head strong')).toHaveText('Fruit');
    await expect(veg.locator('.head strong')).toHaveText('Vegetables');
    await expect(fruit.locator('ul li')).toHaveText(['Apple', 'Banana']);
    await expect(veg.locator('ul li')).toHaveText(['Carrot']);

    const fruitAdd = fruit.locator('.head button');
    const vegAdd = veg.locator('.head button');
    await expect(fruitAdd).toHaveText('+ item');

    await fruitAdd.click();
    await expect(fruit.locator('ul li')).toHaveText([
        'Apple',
        'Banana',
        'New item',
    ]);
    await expect(veg.locator('ul li')).toHaveText(['Carrot']);

    await fruitAdd.click();
    await expect(fruit.locator('ul li')).toHaveText([
        'Apple',
        'Banana',
        'New item',
        'New item',
    ]);
    await expect(veg.locator('ul li')).toHaveText(['Carrot']);

    await vegAdd.click();
    await expect(veg.locator('ul li')).toHaveText(['Carrot', 'New item']);
    await expect(fruit.locator('ul li')).toHaveText([
        'Apple',
        'Banana',
        'New item',
        'New item',
    ]);
});
