import { expect, test } from '@playwright/test';

const POLICY =
    "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:";

test.describe('CSP', () => {
    test('policy header reaches the browser', async ({ page }) => {
        const response = await page.goto('/counter-app');
        expect(response?.headers()['content-security-policy']).toBe(POLICY);
    });

    test('page still hydrates under the policy', async ({ page }) => {
        await page.goto('/counter-app');
        await page.waitForFunction(() => !!customElements.get('counter-app'));

        const button = page.locator('counter-app button');
        await expect(button).toHaveText('count is 0');
        await button.click();
        await expect(button).toHaveText('count is 1');
    });

    test('browser blocks a disallowed image source', async ({
        page,
        browserName,
    }) => {
        test.skip(
            browserName !== 'chromium',
            'violation event is most reliable in chromium',
        );

        await page.goto('/counter-app');
        const directive = await page.evaluate(
            () =>
                new Promise<string>((resolve) => {
                    document.addEventListener(
                        'securitypolicyviolation',
                        (event) =>
                            resolve(
                                event.effectiveDirective ||
                                    event.violatedDirective,
                            ),
                        { once: true },
                    );
                    const img = document.createElement('img');
                    img.src = 'https://example.com/blocked-by-csp.png';
                    document.body.appendChild(img);
                    setTimeout(() => resolve('no-violation'), 3000);
                }),
        );
        expect(directive).toBe('img-src');
    });
});
