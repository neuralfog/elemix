import { expect, test } from '@playwright/test';

test.describe('DirectApp', () => {
    test('class-object binding + boolean attrs hydrate and toggle reactively', async ({
        page,
    }) => {
        const response = await page.goto('/direct-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="box active"');
        expect(served).not.toContain('disabled=');

        await page.waitForFunction(() => !!customElements.get('direct-app'));

        const box = page.locator('direct-app .box');
        const toggles = page.locator('direct-app .toggles button');
        const activeToggle = toggles.nth(0);
        const roundedToggle = toggles.nth(1);
        const largeToggle = toggles.nth(2);

        await expect(box).toHaveClass(/\bbox\b/);
        await expect(box).toHaveClass(/\bactive\b/);
        await expect(box).not.toHaveClass(/\brounded\b/);
        await expect(box).not.toHaveClass(/\blarge\b/);

        await activeToggle.click();
        await expect(box).not.toHaveClass(/\bactive\b/);
        await expect(box).toHaveClass(/\bbox\b/);
        await activeToggle.click();
        await expect(box).toHaveClass(/\bactive\b/);

        await roundedToggle.click();
        await expect(box).toHaveClass(/\brounded\b/);
        await largeToggle.click();
        await expect(box).toHaveClass(/\blarge\b/);
        await expect(box).toHaveClass(/\bactive\b/);

        const action = page.locator('direct-app .action');
        const checkbox = page.locator('direct-app input[type="checkbox"]');

        await expect(action).not.toHaveAttribute('disabled', /.*/);
        await expect(checkbox).not.toBeChecked();

        await checkbox.click();
        await expect(action).toHaveAttribute('disabled', /.*/);
        await expect(checkbox).toBeChecked();

        await checkbox.click();
        await expect(action).not.toHaveAttribute('disabled', /.*/);
        await expect(checkbox).not.toBeChecked();
    });
});
