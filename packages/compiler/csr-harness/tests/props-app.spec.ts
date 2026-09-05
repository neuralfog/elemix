import { expect, test } from '@playwright/test';

test('props-app: props flow to child and mutate back through parent', async ({
    page,
}) => {
    await page.goto('/view/props-app');

    const child = page.locator('props-child');
    const label = child.locator('.label');
    const count = child.locator('.count');
    const flag = child.locator('.flag');
    const tags = child.locator('.tags');
    const pcount = page.locator('.parent .pcount');
    const ptags = page.locator('.parent .ptags');

    await expect(label).toHaveText('hello');
    await expect(count).toHaveText('0');
    await expect(flag).toHaveText('yes');
    await expect(tags).toHaveText('a');
    await expect(pcount).toHaveText('0');
    await expect(ptags).toHaveText('a');

    await child.locator('.bump').click();
    await expect(pcount).toHaveText('1');
    await expect(count).toHaveText('1');
    await child.locator('.bump').click();
    await expect(pcount).toHaveText('2');
    await expect(count).toHaveText('2');

    await child.locator('.add').click();
    await expect(ptags).toHaveText('a,x');
    await expect(tags).toHaveText('a,x');
    await child.locator('.add').click();
    await expect(ptags).toHaveText('a,x,x');
    await expect(tags).toHaveText('a,x,x');

    await child.locator('.push').click();
    await expect(tags).toHaveText('a,x,x,y');
    await expect(ptags).toHaveText('a,x,x,y');
});
