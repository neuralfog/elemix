import { expect, test } from '@playwright/test';

test.describe('SlotApp', () => {
    test('slot projection + conditional hasSlot regions survive hydration', async ({
        page,
    }) => {
        await page.goto('/slot-app');
        await page.waitForFunction(
            () =>
                !!customElements.get('slot-app') &&
                !!customElements.get('app-card'),
        );

        const cards = page.locator('slot-app app-card');
        await expect(cards).toHaveCount(2);

        const first = cards.nth(0);
        await expect(first.locator('.header')).toHaveCount(1);
        await expect(first.locator('.body')).toHaveCount(1);
        await expect(first.locator('.footer')).toHaveCount(1);

        const second = cards.nth(1);
        await expect(second.locator('.header')).toHaveCount(0);
        await expect(second.locator('.footer')).toHaveCount(0);
        await expect(second.locator('.body')).toHaveCount(1);

        const projected = await page.evaluate(() => {
            const shadow = document.querySelector('slot-app')?.shadowRoot;
            const cardEls = shadow?.querySelectorAll('app-card') ?? [];
            const read = (host: Element, sel: string): string => {
                const slot = host.shadowRoot?.querySelector(
                    sel,
                ) as HTMLSlotElement | null;
                return (slot?.assignedNodes() ?? [])
                    .map((n) => n.textContent)
                    .join('');
            };
            return {
                header0: read(cardEls[0], 'slot[name="header"]'),
                body0: read(cardEls[0], 'slot:not([name])'),
                footer0: read(cardEls[0], 'slot[name="footer"]'),
                body1: read(cardEls[1], 'slot:not([name])'),
            };
        });

        expect(projected.header0).toContain('⭐ Featured');
        expect(projected.body0).toContain(
            'Default-slot content lives in the card body.',
        );
        expect(projected.footer0).toContain('Updated just now');
        expect(projected.body1).toContain('This card has only body content');
    });
});
