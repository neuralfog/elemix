import { expect, test } from '@playwright/test';

test('inherit-derived: inherited template, effects and merged styles', async ({
    page,
}) => {
    await page.goto('/view/inherit-derived');

    const app = page.locator('inherit-derived');
    const button = page.locator('.btn');
    await expect(button).toHaveText('count 0');

    await expect(app).toHaveAttribute('data-base-fx', '0');
    await expect(app).toHaveAttribute('data-derived-fx', '0');

    await button.click();
    await button.click();
    await expect(button).toHaveText('count 2');

    await expect(app).toHaveAttribute('data-base-fx', '2');
    await expect(app).toHaveAttribute('data-derived-fx', '2');
    await expect(app).toHaveAttribute('data-base', 'on');
    await expect(app).toHaveAttribute('data-derived', 'on');

    const sheets = await app.evaluate(
        (el: Element) => el.shadowRoot?.adoptedStyleSheets.length,
    );
    expect(sheets).toBe(2);

    await expect(button).toHaveCSS('background-color', 'rgb(220, 38, 38)');
    await expect(button).toHaveCSS('font-weight', '700');
});
