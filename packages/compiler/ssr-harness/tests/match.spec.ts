import { expect, test } from '@playwright/test';

test.describe('MatchApp', () => {
    test('match arms swap reactively (both arities)', async ({ page }) => {
        await page.goto('/match-app');
        await page.waitForFunction(() => !!customElements.get('match-app'));

        const bar = page.locator('match-app .bar button');
        const card = (cls: string) => page.locator(`match-app .card.${cls}`);
        const absentExcept = async (kept: string) => {
            for (const other of ['idle', 'loading', 'ready', 'failed']) {
                if (other !== kept) {
                    await expect(card(other)).toHaveCount(0);
                }
            }
        };

        await expect(card('idle')).toHaveText('Pick a state above');
        await absentExcept('idle');

        await bar.nth(1).click();
        await expect(card('loading')).toContainText('Working 42%');
        await expect(
            page.locator('match-app .card.loading .spinner'),
        ).toHaveCount(1);
        await absentExcept('loading');

        await bar.nth(2).click();
        await expect(card('ready')).toContainText(
            '✓ Deployed to /build/app.js',
        );
        await absentExcept('ready');

        await bar.nth(3).click();
        await expect(card('failed')).toContainText('✕ boom');
        await absentExcept('failed');

        await bar.nth(0).click();
        await expect(card('idle')).toHaveText('Pick a state above');
        await absentExcept('idle');

        const mode = page.locator('match-app .mode');
        const modeButton = page.locator('match-app .link');
        await expect(mode).toHaveText('compact');
        await modeButton.click();
        await expect(mode).toHaveText('full view');
        await modeButton.click();
        await expect(mode).toHaveText('compact');
    });
});
