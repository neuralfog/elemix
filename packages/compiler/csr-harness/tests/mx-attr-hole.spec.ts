import { expect, test } from '@playwright/test';

test('mx-attr-hole: attr present/absent/changed and boolean attr toggle', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/view/mx-attr-hole');
    const box = page.locator('mx-attr-hole .box');
    await expect(box).toHaveAttribute('data-tag', 'one');
    await expect(box).toHaveAttribute('data-n', '1');
    await expect(box).toHaveAttribute('aria-hidden', '');

    await page.locator('mx-attr-hole #clear-tag').click();
    await expect(box).not.toHaveAttribute('data-tag', /.*/);

    await page.locator('mx-attr-hole #set-tag').click();
    await expect(box).toHaveAttribute('data-tag', 'two');

    await page.locator('mx-attr-hole #toggle-flag').click();
    await expect(box).not.toHaveAttribute('aria-hidden', /.*/);

    await page.locator('mx-attr-hole #bump').click();
    await expect(box).toHaveAttribute('data-n', '2');

    expect(errors).toEqual([]);
});
