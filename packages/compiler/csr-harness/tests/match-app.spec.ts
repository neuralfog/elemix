import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const STATES = ['idle', 'loading', 'ready', 'failed'];

const onlyCard = async (
    page: Page,
    cls: string,
    text: string,
): Promise<void> => {
    await expect(page.locator(`.card.${cls}`)).toContainText(text);
    for (const other of STATES) {
        if (other !== cls) {
            await expect(page.locator(`.card.${other}`)).toHaveCount(0);
        }
    }
};

test('match-app: match arms render exclusively and mode toggles', async ({
    page,
}) => {
    await page.goto('/view/match-app');

    const buttons = page.locator('.bar button');
    const idleButton = buttons.nth(0);
    const loadingButton = buttons.nth(1);
    const readyButton = buttons.nth(2);
    const failedButton = buttons.nth(3);

    await onlyCard(page, 'idle', 'Pick a state above');

    await loadingButton.click();
    await onlyCard(page, 'loading', 'Working 42%');
    await expect(page.locator('.card.loading .spinner')).toBeVisible();

    await readyButton.click();
    await onlyCard(page, 'ready', 'Deployed to /build/app.js');

    await failedButton.click();
    await onlyCard(page, 'failed', 'boom');

    await idleButton.click();
    await onlyCard(page, 'idle', 'Pick a state above');

    const modeButton = page.locator('.link');
    await expect(page.locator('.mode')).toHaveText('compact');
    await modeButton.click();
    await expect(page.locator('.mode')).toHaveText('full view');
    await modeButton.click();
    await expect(page.locator('.mode')).toHaveText('compact');
});
