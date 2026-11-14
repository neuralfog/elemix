import { expect, test } from '@playwright/test';

test.describe('Security headers', () => {
    test('HSTS, nosniff and Referrer-Policy reach the browser', async ({
        page,
    }) => {
        const response = await page.goto('/counter-app');
        const headers = response?.headers() ?? {};

        expect(headers['strict-transport-security']).toBe(
            'max-age=63072000; includeSubDomains',
        );
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe(
            'strict-origin-when-cross-origin',
        );
    });
});
