import { expect, test } from '@playwright/test';

test('todo-app: adds and removes todos', async ({ page }) => {
    await page.goto('/view/todo-app');

    const input = page.locator('input');
    const addBtn = page.locator('button.add');

    await expect(page.locator('h3')).toHaveText('Todos');
    await expect(input).toHaveAttribute('placeholder', 'What needs doing?');

    await expect(page.locator('li')).toHaveCount(1);
    await expect(page.locator('li span').first()).toHaveText('Learn Elemix');

    await input.fill('   ');
    await addBtn.click();
    await expect(page.locator('li')).toHaveCount(1);
    await expect(input).toHaveValue('   ');

    await input.fill('Buy milk');
    await addBtn.click();
    await expect(page.locator('li')).toHaveCount(2);
    await expect(page.locator('li').nth(1).locator('span')).toHaveText(
        'Buy milk',
    );
    await expect(input).toHaveValue('');

    await input.fill('Walk dog');
    await input.press('Enter');
    await expect(page.locator('li')).toHaveCount(3);
    await expect(page.locator('li').nth(2).locator('span')).toHaveText(
        'Walk dog',
    );
    await expect(input).toHaveValue('');

    const removeMilk = page.locator('li').nth(1).locator('button.remove');
    await expect(removeMilk).toHaveText('×');
    await removeMilk.click();
    await expect(page.locator('li')).toHaveCount(2);
    await expect(page.locator('li').nth(0).locator('span')).toHaveText(
        'Learn Elemix',
    );
    await expect(page.locator('li').nth(1).locator('span')).toHaveText(
        'Walk dog',
    );

    await page.locator('li').nth(1).locator('button.remove').click();
    await expect(page.locator('li')).toHaveCount(1);
    await page.locator('li').nth(0).locator('button.remove').click();
    await expect(page.locator('li')).toHaveCount(0);

    await input.fill('Restart');
    await input.press('Enter');
    await expect(page.locator('li')).toHaveCount(1);
    await expect(page.locator('li').nth(0).locator('span')).toHaveText(
        'Restart',
    );
});
