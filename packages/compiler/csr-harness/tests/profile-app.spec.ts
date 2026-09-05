import { expect, test } from '@playwright/test';

test('profile-app: inputs drive child card and likes', async ({ page }) => {
    await page.goto('/view/profile-app');

    const nameInput = page.locator('input').nth(0);
    const roleInput = page.locator('input').nth(1);
    const like = page.locator('button').first();
    const avatar = page.locator('.avatar');
    const cardName = page.locator('.info strong');
    const cardRole = page.locator('.info span');
    const likes = page.locator('.likes');

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

    await like.click();
    await expect(likes).toHaveText('❤️ 1');
    await like.click();
    await expect(likes).toHaveText('❤️ 2');
});
