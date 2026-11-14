import { expect, test } from '@playwright/test';

test('signal-app: two sibling components share a #state store; buttons in one drive the value in the other', async ({
    page,
}) => {
    await page.goto('/view/signal-app');
    await page.waitForFunction(
        () =>
            !!customElements.get('signal-value') &&
            !!customElements.get('signal-buttons'),
    );

    const value = page.locator('signal-app signal-value .value');
    const buttons = page.locator('signal-app signal-buttons button');
    const dec = buttons.nth(0);
    const reset = buttons.nth(1);
    const inc = buttons.nth(2);

    await expect(value).toHaveText('0');

    await inc.click();
    await inc.click();
    await inc.click();
    await expect(value).toHaveText('3');

    await dec.click();
    await expect(value).toHaveText('2');

    await reset.click();
    await expect(value).toHaveText('0');

    await dec.click();
    await expect(value).toHaveText('-1');
});
