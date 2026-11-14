import { expect, test } from '@playwright/test';

test('reset-mixed: a shadow parent with a no-shadow child, both get the reset', async ({
    page,
}) => {
    await page.addInitScript(() => {
        (
            window as unknown as {
                __elemix__?: { config?: Record<string, unknown> };
            }
        ).__elemix__ = {
            config: { reset: '.reset-probe{color:rgb(7,8,9)}' },
        };
    });
    await page.goto('/view/reset-mixed');
    await page.waitForFunction(() => !!customElements.get('reset-probe-light'));

    const shadowSpan = page
        .locator('reset-mixed span[data-part="shadow"]')
        .first();
    const lightSpan = page
        .locator('reset-mixed reset-probe-light .reset-probe')
        .first();

    const shadowColor = await shadowSpan.evaluate(
        (el) => getComputedStyle(el).color,
    );
    const lightColor = await lightSpan.evaluate(
        (el) => getComputedStyle(el).color,
    );

    expect(shadowColor).toBe('rgb(7, 8, 9)');
    expect(lightColor).toBe('rgb(7, 8, 9)');
});
