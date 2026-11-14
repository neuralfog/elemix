import { expect, test } from '@playwright/test';

test('card-list-app: keyed repeat of child components add / promote / remove', async ({
    page,
}) => {
    await page.goto('/view/card-list-app');
    await page.waitForFunction(() => !!customElements.get('user-card'));

    const cards = page.locator('card-list-app user-card');
    const rows = page.locator('card-list-app .row');
    const name = (i: number) => cards.nth(i).locator('.name');
    const role = (i: number) => cards.nth(i).locator('.role');

    await expect(cards).toHaveCount(2);
    await expect(name(0)).toHaveText('Ada');
    await expect(role(0)).toHaveText('Engineer');
    await expect(name(1)).toHaveText('Grace');

    await rows.nth(0).locator('.promote').click();
    await expect(role(0)).toHaveText('Lead');
    await expect(role(1)).toHaveText('Engineer');

    await page.locator('card-list-app .bar button').click();
    await expect(cards).toHaveCount(3);
    await expect(name(2)).toHaveText('Margaret');

    await rows.nth(0).locator('.drop').click();
    await expect(cards).toHaveCount(2);
    await expect(name(0)).toHaveText('Grace');
    await expect(name(1)).toHaveText('Margaret');
});
