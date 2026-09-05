import { expect, test } from '@playwright/test';

test('status-app: cycles status cards and toggles the log', async ({
    page,
}) => {
    await page.goto('/view/status-app');

    const idle = page.locator('.card.idle');
    await expect(idle).toContainText('Pick a status above');
    await expect(page.locator('.card.loading')).toHaveCount(0);
    await expect(page.locator('.card.ready')).toHaveCount(0);
    await expect(page.locator('.card.failed')).toHaveCount(0);

    const idleButton = page.locator('button').nth(0);
    const loadingButton = page.locator('button').nth(1);
    const readyButton = page.locator('button').nth(2);
    const failedButton = page.locator('button').nth(3);
    const logButton = page.locator('.link');
    await expect(idleButton).toHaveText('Idle');
    await expect(loadingButton).toHaveText('Loading');
    await expect(readyButton).toHaveText('Ready');
    await expect(failedButton).toHaveText('Failed');
    await expect(logButton).toHaveText('Show log');

    await loadingButton.click();
    const loading = page.locator('.card.loading');
    await expect(loading).toContainText('Working');
    await expect(loading.locator('.spinner')).toHaveCount(1);
    await expect(page.locator('.card.idle')).toHaveCount(0);

    await readyButton.click();
    await expect(page.locator('.card.ready')).toContainText('Deployed');
    await expect(page.locator('.card.loading')).toHaveCount(0);

    await failedButton.click();
    await expect(page.locator('.card.failed')).toContainText('Build failed');
    await expect(page.locator('.card.ready')).toHaveCount(0);

    await idleButton.click();
    await expect(page.locator('.card.idle')).toHaveCount(1);
    await expect(page.locator('.card.failed')).toHaveCount(0);

    await expect(page.locator('pre.log')).toHaveCount(0);
    await logButton.click();
    await expect(page.locator('pre.log')).toContainText('status = idle');
    await expect(logButton).toHaveText('Hide log');

    await readyButton.click();
    await expect(page.locator('pre.log')).toContainText('status = ready');

    await logButton.click();
    await expect(page.locator('pre.log')).toHaveCount(0);
    await expect(logButton).toHaveText('Show log');
});
