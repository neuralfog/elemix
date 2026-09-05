import { expect, test } from '@playwright/test';

test('deep-leaf: deep inheritance chain runs effects, styles and template', async ({
    page,
}) => {
    await page.goto('/view/deep-leaf');
    const app = page.locator('deep-leaf');
    const button = page.locator('.btn');

    await expect(button).toHaveText('count 0');
    await expect(app).toHaveAttribute('data-base-fx', '0');
    await expect(app).toHaveAttribute('data-middle-fx', '0');
    await expect(app).toHaveAttribute('data-leg-fx', '0');
    await expect(app).toHaveAttribute('data-leaf-fx', '0');

    await button.click();
    await button.click();
    await expect(button).toHaveText('count 2');
    await expect(app).toHaveAttribute('data-base-fx', '2');
    await expect(app).toHaveAttribute('data-middle-fx', '2');
    await expect(app).toHaveAttribute('data-leg-fx', '2');
    await expect(app).toHaveAttribute('data-leaf-fx', '2');
    await expect(app).toHaveAttribute('data-base', 'on');
    await expect(app).toHaveAttribute('data-middle', 'on');
    await expect(app).toHaveAttribute('data-leg', 'on');
    await expect(app).toHaveAttribute('data-leaf', 'on');

    const sheets = await app.evaluate(
        (el) =>
            (el as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot
                .adoptedStyleSheets.length,
    );
    expect(sheets).toBe(4);

    const css = await button.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
            backgroundColor: s.backgroundColor,
            fontWeight: s.fontWeight,
            fontStyle: s.fontStyle,
            textDecorationLine: s.textDecorationLine,
        };
    });
    expect(css.backgroundColor).toBe('rgb(220, 38, 38)');
    expect(css.fontWeight).toBe('700');
    expect(css.fontStyle).toBe('italic');
    expect(css.textDecorationLine).toBe('underline');
});
