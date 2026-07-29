import { expect, test } from '@playwright/test';

test.describe('ProfileApp', () => {
    test('~model refs flow through :props into a hydrated child ProfileCard; reactive', async ({
        page,
    }) => {
        const response = await page.goto('/profile-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('profile-app');
        expect(served).toContain('profile-card');
        expect(served).toContain('value="Ada Lovelace"');
        expect(served).toContain('value="Engineer"');
        expect(served).toContain('❤️ 0');

        await page.waitForFunction(
            () =>
                !!customElements.get('profile-app') &&
                !!customElements.get('profile-card'),
        );

        const nameInput = page.locator('profile-app input').nth(0);
        const roleInput = page.locator('profile-app input').nth(1);
        const likeBtn = page.locator('profile-app .controls button');
        const avatar = page.locator('profile-app profile-card .avatar');
        const cardName = page.locator('profile-app profile-card .info strong');
        const cardRole = page.locator('profile-app profile-card .info span');
        const likes = page.locator('profile-app profile-card .likes');

        await expect(nameInput).toHaveValue('Ada Lovelace');
        await expect(roleInput).toHaveValue('Engineer');
        await expect(avatar).toHaveText('A');
        await expect(cardName).toHaveText('Ada Lovelace');
        await expect(cardRole).toHaveText('Engineer');
        await expect(likes).toHaveText('❤️ 0');

        await nameInput.click();
        await nameInput.press('End');
        await nameInput.pressSequentially('!');
        await expect(nameInput).toHaveValue('Ada Lovelace!');
        await expect(cardName).toHaveText('Ada Lovelace!');
        await expect(avatar).toHaveText('A');

        await roleInput.click();
        await roleInput.press('End');
        await roleInput.pressSequentially(' Lead');
        await expect(roleInput).toHaveValue('Engineer Lead');
        await expect(cardRole).toHaveText('Engineer Lead');

        await likeBtn.click();
        await expect(likes).toHaveText('❤️ 1');
        await likeBtn.click();
        await expect(likes).toHaveText('❤️ 2');
    });
});
