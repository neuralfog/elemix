import { expect, test } from '@playwright/test';

test.describe('RefApp', () => {
    test(':ref binds the server-rendered input on hydrate; focus + measure mount the conditional readout', async ({
        page,
    }) => {
        const response = await page.goto('/ref-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('ref-app');
        expect(served).toContain('placeholder="Type something…"');
        expect(served).not.toContain('class="out"');

        await page.waitForFunction(() => !!customElements.get('ref-app'));

        const input = page.locator('ref-app input');
        const focus = page.locator('ref-app button').nth(0);
        const measure = page.locator('ref-app .ghost');
        const out = page.locator('ref-app .out');

        await expect(focus).toHaveText('Focus');
        await expect(measure).toHaveText('Measure width');
        await expect(out).toHaveCount(0);

        await focus.click();
        const focused = await input.evaluate(
            (el) =>
                el.getRootNode() instanceof ShadowRoot &&
                (el.getRootNode() as ShadowRoot).activeElement === el,
        );
        expect(focused).toBe(true);
        await expect(out).toHaveCount(0);

        await measure.click();
        await expect(out).toHaveCount(1);
        await expect(out).toContainText('px wide');
        const text = (await out.textContent()) ?? '';
        const match = text.match(/Input is (\d+)px wide/);
        expect(match).not.toBeNull();
        expect(Number(match?.[1])).toBeGreaterThan(0);
    });
});
