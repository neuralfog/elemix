import { expect, test } from '@playwright/test';

test('code-tabs-app: pre content hydrates verbatim and the reactive class toggles panels', async ({
    page,
}) => {
    await page.goto('/view/code-tabs-app');

    const ts = page.locator('#panel-ts');
    const scss = page.locator('#panel-scss');

    await expect(ts).toHaveClass('panel');
    await expect(scss).toHaveClass('panel hidden');

    await expect(ts.locator('code')).toContainText("import x from 'y';");
    await expect(ts.locator('code')).toContainText('// #state');
    expect(await ts.locator('code').textContent()).toContain(
        '\n    count = 0;',
    );

    await page.locator('#to-scss').click();
    await expect(scss).toHaveClass('panel');
    await expect(ts).toHaveClass('panel hidden');

    await page.locator('#to-ts').click();
    await expect(ts).toHaveClass('panel');
    await expect(scss).toHaveClass('panel hidden');
});
