import { expect, test } from '@playwright/test';

test.describe('LifecycleApp', () => {
    test('child mount/update/unmount fires ordered lifecycle hooks into a shared reactive log', async ({
        page,
    }) => {
        const response = await page.goto('/lifecycle-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('lifecycle-app');
        expect(served).toContain('child unmounted');
        expect(served).toContain('No events yet');
        expect(served).toContain('>Mount</button>');
        expect(served).toContain('disabled');

        await page.waitForFunction(
            () =>
                !!customElements.get('lifecycle-app') &&
                !!customElements.get('lifecycle-child') &&
                !!customElements.get('log-view'),
        );

        const empty = page.locator('lifecycle-app .stage .empty');
        const child = page.locator('lifecycle-app lifecycle-child .child');
        const logEntries = page.locator('lifecycle-app log-view .entry .n');
        const mountBtn = page.locator('lifecycle-app .buttons button').nth(0);
        const updateBtn = page.locator('lifecycle-app .buttons button').nth(1);
        const clearBtn = page.locator('lifecycle-app .buttons .ghost');

        await expect(empty).toHaveText('child unmounted');
        await expect(mountBtn).toHaveText('Mount');
        await expect(updateBtn).toBeDisabled();
        await expect(
            page.locator('lifecycle-app log-view .empty'),
        ).toBeVisible();
        await expect(logEntries).toHaveCount(0);

        await mountBtn.click();
        await expect(child).toHaveText('Child · tick 0');
        await expect(mountBtn).toHaveText('Unmount');
        await expect(updateBtn).toBeEnabled();
        await expect(logEntries).toHaveText(['1', '2', '3', '4']);
        await expect(page.locator('lifecycle-app log-view .entry')).toHaveText([
            /before-1/,
            /before-2/,
            /mount-1/,
            /mount-2/,
        ]);

        await updateBtn.click();
        await expect(child).toHaveText('Child · tick 1');
        await expect(logEntries).toHaveCount(4);

        await mountBtn.click();
        await expect(empty).toHaveText('child unmounted');
        await expect(logEntries).toHaveText(['1', '2', '3', '4', '5', '6']);
        await expect(
            page.locator('lifecycle-app log-view .entry').nth(4),
        ).toHaveText(/dispose-1/);
        await expect(
            page.locator('lifecycle-app log-view .entry').nth(5),
        ).toHaveText(/dispose-2/);

        await clearBtn.click();
        await expect(logEntries).toHaveCount(0);
        await expect(
            page.locator('lifecycle-app log-view .empty'),
        ).toBeVisible();
    });
});
