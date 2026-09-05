import { expect, test } from '@playwright/test';

test('scss-app: compiled scss lands in adopted styles and counter reacts', async ({
    page,
}) => {
    await page.goto('/view/scss-app');

    const cssText = await page.locator('scss-app').evaluate((el) => {
        const root = (el as HTMLElement & { shadowRoot: ShadowRoot | null })
            .shadowRoot;
        if (!root || root.adoptedStyleSheets.length === 0) return '';
        return Array.from(root.adoptedStyleSheets[0].cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
    });

    expect(cssText).toContain('#6366f1');
    expect(cssText).toContain('button:hover');
    expect(cssText).not.toContain('$accent');

    await expect(page.locator('.card')).toHaveCount(1);
    const button = page.locator('button');
    await expect(button).toContainText('count is 0');
    await button.click();
    await expect(button).toContainText('count is 1');
});
