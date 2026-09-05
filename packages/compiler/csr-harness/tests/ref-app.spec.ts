import { expect, test } from '@playwright/test';

test('ref-app: focus ref and measure width on demand', async ({ page }) => {
    await page.goto('/view/ref-app');

    const input = page.locator('input');
    const focus = page.locator('button').nth(0);
    const measure = page.locator('button').nth(1);

    await expect(focus).toHaveText('Focus');
    await expect(measure).toHaveText('Measure width');
    await expect(measure).toHaveClass(/\bghost\b/);
    await expect(input).toHaveAttribute('placeholder', 'Type something…');

    await expect(page.locator('.out')).toHaveCount(0);

    await focus.click();
    await expect(input).toBeFocused();
    await expect(page.locator('.out')).toHaveCount(0);

    await measure.click();
    const out = page.locator('.out');
    await expect(out).toContainText('Input is');
    await expect(out).toContainText('px wide');

    const text = (await out.textContent()) ?? '';
    const match = text.match(/Input is (\d+)px wide/);
    if (!match) throw new Error('width readout did not match expected format');

    const width = await input.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(Number(match[1])).toBe(width);
    expect(width).toBeGreaterThan(0);
});
