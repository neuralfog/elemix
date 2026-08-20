import { expect, test } from '@playwright/test';

test.describe('ResetProbe (App.resetStyles)', () => {
    test('reset is injected into SSR shadow styles, config, and applies after hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/reset-probe');
        const served = (await response?.text()) ?? '';

        // SSR: the reset is prepended into the component's shadow <style data-ssr>
        expect(served).toContain(
            '<style data-ssr>.reset-probe{color:rgb(7,8,9)}',
        );

        // SSR: the client config carries the reset so CSR adoptStyles can apply it
        expect(served).toContain('window.__elemix__');
        expect(served).toContain('config.reset=');

        await page.waitForFunction(() => !!customElements.get('reset-probe'));

        // after hydration the reset sheet is adopted into the shadow, so the
        // .reset-probe element resolves to the reset colour
        const probe = page.locator('reset-probe .reset-probe').first();
        await expect(probe).toHaveText('probe');
        const color = await probe.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe('rgb(7, 8, 9)');
    });

    test('no-shadow: reset reaches light DOM via a document <style>', async ({
        page,
    }) => {
        const response = await page.goto('/reset-probe-light');
        const served = (await response?.text()) ?? '';

        // a #no-shadow component has no <style data-ssr>; the reset rides on a
        // document-level <style> so its light-DOM content is covered too
        expect(served).toContain(
            '<style>.reset-probe{color:rgb(7,8,9)}</style>',
        );

        await page.waitForFunction(
            () => !!customElements.get('reset-probe-light'),
        );

        const probe = page.locator('reset-probe-light .reset-probe').first();
        await expect(probe).toHaveText('probe');
        const color = await probe.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe('rgb(7, 8, 9)');
    });

    test('mixture: a shadow parent with a no-shadow child, both get the reset', async ({
        page,
    }) => {
        await page.goto('/reset-mixed');
        await page.waitForFunction(() => !!customElements.get('reset-mixed'));
        await page.waitForFunction(
            () => !!customElements.get('reset-probe-light'),
        );

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
});
