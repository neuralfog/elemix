import { expect, test } from '@playwright/test';

test('direct-app: class toggles and disabled binding', async ({ page }) => {
    await page.goto('/view/direct-app');

    const box = page.locator('.box');
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bactive\b/);
    await expect(box).not.toHaveClass(/\brounded\b/);
    await expect(box).not.toHaveClass(/\blarge\b/);

    const toggles = page.locator('.toggles button');
    const activeToggle = toggles.nth(0);
    const roundedToggle = toggles.nth(1);
    const largeToggle = toggles.nth(2);
    await expect(activeToggle).toHaveText('active');
    await expect(roundedToggle).toHaveText('rounded');
    await expect(largeToggle).toHaveText('large');

    await activeToggle.click();
    await expect(box).not.toHaveClass(/\bactive\b/);
    await expect(box).toHaveClass(/\bbox\b/);
    await activeToggle.click();
    await expect(box).toHaveClass(/\bactive\b/);

    await roundedToggle.click();
    await expect(box).toHaveClass(/\brounded\b/);
    await roundedToggle.click();
    await expect(box).not.toHaveClass(/\brounded\b/);

    await largeToggle.click();
    await expect(box).toHaveClass(/\blarge\b/);
    await largeToggle.click();
    await expect(box).not.toHaveClass(/\blarge\b/);

    await roundedToggle.click();
    await largeToggle.click();
    await expect(box).toHaveClass(/\bactive\b/);
    await expect(box).toHaveClass(/\brounded\b/);
    await expect(box).toHaveClass(/\blarge\b/);

    const action = page.locator('.action');
    await expect(action).toHaveText('Action');
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(action).not.toHaveAttribute('disabled');
    await expect(checkbox).not.toBeChecked();

    await checkbox.click();
    await expect(action).toHaveAttribute('disabled');
    await expect(checkbox).toBeChecked();

    await checkbox.click();
    await expect(action).not.toHaveAttribute('disabled');
    await expect(checkbox).not.toBeChecked();
});
