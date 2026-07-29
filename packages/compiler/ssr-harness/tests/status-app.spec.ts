import { expect, test } from '@playwright/test';

test.describe('StatusApp', () => {
    test('choose + when structural holes SSR the active branch and swap reactively after hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/status-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('status-app');
        expect(served).toContain('card idle');
        expect(served).toContain('Pick a status above');
        expect(served).not.toContain('card loading');
        expect(served).not.toContain('pre class="log"');

        await page.waitForFunction(() => !!customElements.get('status-app'));

        const stage = page.locator('status-app .stage');
        const idleBtn = page.locator('status-app .bar button').nth(0);
        const loadingBtn = page.locator('status-app .bar button').nth(1);
        const readyBtn = page.locator('status-app .bar button').nth(2);
        const failedBtn = page.locator('status-app .bar button').nth(3);
        const logBtn = page.locator('status-app .link');
        const log = page.locator('status-app pre.log');

        await expect(stage.locator('.card.idle')).toHaveText(
            'Pick a status above',
        );
        await expect(logBtn).toHaveText('Show log');

        await loadingBtn.click();
        await expect(stage.locator('.card.loading')).toContainText('Working');
        await expect(stage.locator('.spinner')).toHaveCount(1);
        await expect(stage.locator('.card.idle')).toHaveCount(0);

        await readyBtn.click();
        await expect(stage.locator('.card.ready')).toContainText('Deployed');
        await expect(stage.locator('.card.loading')).toHaveCount(0);

        await failedBtn.click();
        await expect(stage.locator('.card.failed')).toContainText(
            'Build failed',
        );

        await idleBtn.click();
        await expect(stage.locator('.card.idle')).toHaveCount(1);
        await expect(stage.locator('.card.failed')).toHaveCount(0);

        await expect(log).toHaveCount(0);
        await logBtn.click();
        await expect(log).toContainText('status = idle');
        await expect(logBtn).toHaveText('Hide log');

        await readyBtn.click();
        await expect(log).toContainText('status = ready');

        await logBtn.click();
        await expect(log).toHaveCount(0);
        await expect(logBtn).toHaveText('Show log');
    });
});
