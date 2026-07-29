import { expect, test } from '@playwright/test';

test.describe('TodoApp', () => {
    test('~model draft + keyed todo repeat: add (click + Enter), whitespace guard, remove, rebuild', async ({
        page,
    }) => {
        const response = await page.goto('/todo-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('todo-app');
        expect(served).toContain('Todos');
        expect(served).toContain('Learn Elemix');

        await page.waitForFunction(() => !!customElements.get('todo-app'));

        const input = page.locator('todo-app input');
        const addBtn = page.locator('todo-app button.add');
        const items = page.locator('todo-app li');
        const spans = page.locator('todo-app li span');

        await expect(page.locator('todo-app h3')).toHaveText('Todos');
        await expect(input).toHaveAttribute('placeholder', 'What needs doing?');
        await expect(items).toHaveCount(1);
        await expect(spans.nth(0)).toHaveText('Learn Elemix');

        await input.click();
        await input.pressSequentially('   ');
        await addBtn.click();
        await expect(items).toHaveCount(1);
        await expect(input).toHaveValue('   ');

        await input.fill('');
        await input.pressSequentially('Buy milk');
        await addBtn.click();
        await expect(items).toHaveCount(2);
        await expect(spans.nth(1)).toHaveText('Buy milk');
        await expect(input).toHaveValue('');

        await input.pressSequentially('Walk dog');
        await input.press('Enter');
        await expect(items).toHaveCount(3);
        await expect(spans.nth(2)).toHaveText('Walk dog');
        await expect(input).toHaveValue('');

        await items.nth(1).locator('button.remove').click();
        await expect(items).toHaveCount(2);
        await expect(spans.nth(0)).toHaveText('Learn Elemix');
        await expect(spans.nth(1)).toHaveText('Walk dog');

        await items.nth(1).locator('button.remove').click();
        await items.nth(0).locator('button.remove').click();
        await expect(items).toHaveCount(0);

        await input.pressSequentially('Restart');
        await input.press('Enter');
        await expect(items).toHaveCount(1);
        await expect(spans.nth(0)).toHaveText('Restart');
    });
});
