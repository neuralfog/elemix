import { expect, test } from '@playwright/test';

test.describe('StepperWidget', () => {
    test('#tag ui-stepper overrides the derived tag; SSRs + hydrates under the explicit tag', async ({
        page,
    }) => {
        const response = await page.goto('/stepper-widget');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('<ui-stepper');
        expect(served).not.toContain('stepper-widget');
        expect(served).toContain('>0</span>');

        await page.waitForFunction(() => !!customElements.get('ui-stepper'));

        const host = page.locator('ui-stepper');
        const count = page.locator('ui-stepper .count');
        const dec = page.locator('ui-stepper button').nth(0);
        const inc = page.locator('ui-stepper button').nth(1);

        const sheets = await host.evaluate(
            (el) =>
                (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot
                    ?.adoptedStyleSheets.length ?? 0,
        );
        expect(sheets).toBeGreaterThan(0);

        await expect(count).toHaveText('0');
        await inc.click();
        await expect(count).toHaveText('1');
        await inc.click();
        await expect(count).toHaveText('2');
        await dec.click();
        await expect(count).toHaveText('1');
    });
});
