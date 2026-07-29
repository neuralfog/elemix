import { expect, test } from '@playwright/test';

test.describe('AttrApp', () => {
    test('attribute holes hydrate and stay reactive', async ({ page }) => {
        const response = await page.goto('/attr-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('href="/users/1"');
        expect(served).toContain('title="Ada"');
        expect(served).toContain('data-count="1"');
        expect(served).not.toContain('hidden=');

        await page.waitForFunction(() => !!customElements.get('attr-app'));

        const link = page.locator('attr-app a.link');
        const badge = page.locator('attr-app span.badge');
        const secret = page.locator('attr-app .secret');
        const nextBtn = page.locator('attr-app button').nth(0);
        const renameBtn = page.locator('attr-app button').nth(1);
        const toggleBtn = page.locator('attr-app button').nth(2);

        await expect(link).toHaveText('Open profile #1');
        await expect(link).toHaveAttribute('href', '/users/1');
        await expect(link).toHaveAttribute('title', 'Ada');
        await expect(badge).toHaveText('Ada');
        await expect(badge).toHaveAttribute('data-count', '1');
        await expect(badge).toHaveAttribute('aria-label', 'Ada');
        await expect(secret).not.toHaveAttribute('hidden', /.*/);

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
        await expect(secret).toHaveAttribute('hidden', /.*/);
        await toggleBtn.click();
        await expect(secret).not.toHaveAttribute('hidden', /.*/);
    });
});
