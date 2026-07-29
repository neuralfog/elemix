import { expect, test } from '@playwright/test';

test.describe('ConditionalApp', () => {
    test('two independent ternary regions mount/unmount reactively', async ({
        page,
    }) => {
        await page.goto('/conditional-app');
        await page.waitForFunction(
            () => !!customElements.get('conditional-app'),
        );

        const guest = page.locator('conditional-app .card.guest');
        const welcome = page.locator('conditional-app .card.welcome');
        const tip = page.locator('conditional-app .tip');
        const signButton = page.locator('conditional-app button').nth(0);
        const tipButton = page.locator('conditional-app button.ghost');

        await expect(guest).toContainText('You are signed out');
        await expect(guest).toContainText('Sign in to see your dashboard.');
        await expect(welcome).toHaveCount(0);
        await expect(tip).toContainText('mount and unmount');
        await expect(signButton).toHaveText('Sign in');
        await expect(tipButton).toHaveText('Hide tip');

        await signButton.click();
        await expect(welcome).toContainText('Welcome back');
        await expect(welcome).toContainText('You are signed in.');
        await expect(guest).toHaveCount(0);
        await expect(signButton).toHaveText('Sign out');

        await signButton.click();
        await expect(welcome).toHaveCount(0);
        await expect(guest).toHaveCount(1);
        await expect(signButton).toHaveText('Sign in');

        await tipButton.click();
        await expect(tip).toHaveCount(0);
        await expect(tipButton).toHaveText('Show tip');

        await tipButton.click();
        await expect(tip).toHaveCount(1);
        await expect(tipButton).toHaveText('Hide tip');

        await signButton.click();
        await expect(welcome).toHaveCount(1);
        await expect(tip).toHaveCount(1);
    });
});
