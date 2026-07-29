import { expect, test } from '@playwright/test';

test.describe('SsrCycleApp', () => {
    test('every request renders a FRESH module store (no cross-request leak); full lifecycle each reload', async ({
        page,
    }) => {
        for (let reload = 0; reload < 3; reload++) {
            const response = await page.goto('/ssr-cycle-app');
            const served = (await response?.text()) ?? '';

            const serverLog = [...served.matchAll(/<li>([^<]*)<\/li>/g)].map(
                (m) => m[1],
            );
            expect(
                serverLog,
                `reload ${reload}: server log must be fresh`,
            ).toEqual(['before-mount']);
            expect(served).toContain('<span class="status">ready</span>');

            await page.waitForFunction(
                () =>
                    !!customElements.get('ssr-cycle-app') &&
                    !!customElements.get('ssr-cycle-probe'),
            );

            const status = page.locator(
                'ssr-cycle-app ssr-cycle-probe .status',
            );
            const log = page.locator('ssr-cycle-app ul.log li');
            const empty = page.locator('ssr-cycle-app .stage .empty');
            const toggle = page.locator('ssr-cycle-app .toggle');

            await expect(status).toHaveText('ready');
            await expect(log).toHaveText(['before-mount', 'mount']);

            await toggle.click();
            await expect(empty).toHaveText('unmounted');
            await expect(log).toHaveText(['before-mount', 'mount', 'dispose']);

            await toggle.click();
            await expect(status).toHaveText('ready');
            await expect(log).toHaveText([
                'before-mount',
                'mount',
                'dispose',
                'before-mount',
                'mount',
            ]);
        }
    });

    test('concurrent requests each render a fresh store (no cross-request bleed)', async ({
        request,
    }) => {
        const results = await Promise.all(
            Array.from({ length: 40 }, () =>
                request
                    .get('/ssr-cycle-app')
                    .then((r) => r.text())
                    .then((html) =>
                        [...html.matchAll(/<li>([^<]*)<\/li>/g)].map(
                            (m) => m[1],
                        ),
                    ),
            ),
        );
        for (const log of results) {
            expect(log).toEqual(['before-mount']);
        }
    });
});
