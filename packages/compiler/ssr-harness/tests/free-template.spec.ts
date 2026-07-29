import { expect, test } from '@playwright/test';

test.describe('FreeTemplate', () => {
    test('a wrapper-less free template SSRs and re-mounts reactive on the client', async ({
        page,
    }) => {
        const response = await page.goto('/free-template');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('data-elemix-view');
        expect(served).toContain('value="Ada Lovelace"');
        expect(served).toContain('profile-card');

        await page.waitForFunction(() => !!customElements.get('profile-card'));

        const view = page.locator('[data-elemix-view]');
        const input = view.locator('input');
        const cardName = view.locator('profile-card .info strong');
        const avatar = view.locator('profile-card .avatar');
        const likes = view.locator('profile-card .likes');

        await expect(input).toHaveValue('Ada Lovelace');
        await expect(cardName).toHaveText('Ada Lovelace');
        await expect(avatar).toHaveText('A');
        await expect(likes).toHaveText('❤️ 0');

        await input.click();
        await input.press('End');
        await input.pressSequentially('!');
        await expect(input).toHaveValue('Ada Lovelace!');
        await expect(cardName).toHaveText('Ada Lovelace!');
        await expect(avatar).toHaveText('A');
    });
});
