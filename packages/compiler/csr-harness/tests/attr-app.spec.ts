import { expect, test } from '@playwright/test';

test('attr-app: reactive attributes, rename and toggle', async ({ page }) => {
    await page.goto('/view/attr-app');
    const link = page.locator('a.link');
    const badge = page.locator('span.badge');
    const secret = page.locator('.secret');
    const buttons = page.locator('button');
    const nextBtn = buttons.nth(0);
    const renameBtn = buttons.nth(1);
    const toggleBtn = buttons.nth(2);

    await expect(link).toHaveText('Open profile #1');
    await expect(link).toHaveAttribute('href', '/users/1');
    await expect(link).toHaveAttribute('title', 'Ada');
    await expect(badge).toHaveText('Ada');
    await expect(badge).toHaveAttribute('data-count', '1');
    await expect(badge).toHaveAttribute('aria-label', 'Ada');
    await expect(secret).not.toHaveAttribute('hidden');

    await nextBtn.click();
    await expect(link).toHaveText('Open profile #2');
    await expect(link).toHaveAttribute('href', '/users/2');
    await expect(badge).toHaveAttribute('data-count', '2');
    await nextBtn.click();
    await expect(link).toHaveText('Open profile #3');
    await expect(link).toHaveAttribute('href', '/users/3');
    await expect(badge).toHaveAttribute('data-count', '3');

    await renameBtn.click();
    await expect(badge).toHaveText('Grace');
    await expect(badge).toHaveAttribute('aria-label', 'Grace');
    await expect(link).toHaveAttribute('title', 'Grace');
    await renameBtn.click();
    await expect(badge).toHaveText('Ada');
    await expect(badge).toHaveAttribute('aria-label', 'Ada');
    await expect(link).toHaveAttribute('title', 'Ada');

    await toggleBtn.click();
    await expect(secret).toHaveAttribute('hidden');
    await toggleBtn.click();
    await expect(secret).not.toHaveAttribute('hidden');
});
