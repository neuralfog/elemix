import { expect, test } from '@playwright/test';

test('conditional-app: sign in/out and tip toggle', async ({ page }) => {
    await page.goto('/view/conditional-app');
    const guest = page.locator('.card.guest');
    await expect(guest).toContainText('You are signed out');
    await expect(guest).toContainText('Sign in to see your dashboard.');
    await expect(page.locator('.card.welcome')).toHaveCount(0);
    await expect(page.locator('.tip')).toContainText('mount and unmount');

    const sign = page.locator('button').nth(0);
    const tip = page.locator('button').nth(1);
    await expect(tip).toHaveClass(/\bghost\b/);
    await expect(sign).toHaveText('Sign in');
    await expect(tip).toHaveText('Hide tip');

    await sign.click();
    await expect(page.locator('.card.welcome')).toContainText('Welcome back');
    await expect(page.locator('.card.welcome')).toContainText(
        'You are signed in.',
    );
    await expect(page.locator('.card.guest')).toHaveCount(0);
    await expect(sign).toHaveText('Sign out');

    await sign.click();
    await expect(page.locator('.card.welcome')).toHaveCount(0);
    await expect(page.locator('.card.guest')).toHaveCount(1);
    await expect(sign).toHaveText('Sign in');

    await tip.click();
    await expect(page.locator('.tip')).toHaveCount(0);
    await expect(tip).toHaveText('Show tip');

    await tip.click();
    await expect(page.locator('.tip')).toHaveCount(1);
    await expect(tip).toHaveText('Hide tip');

    await sign.click();
    await expect(page.locator('.card.welcome')).toHaveCount(1);
    await expect(page.locator('.tip')).toHaveCount(1);
});
