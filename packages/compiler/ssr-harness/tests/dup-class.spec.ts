import { expect, test } from '@playwright/test';

test.describe('SSR dynamic class de-duplication (SSR vs CSR parity)', () => {
    test('a repeated class token is de-duplicated server-side like CSR', async ({
        page,
    }) => {
        const response = await page.goto('/dup-class-app');
        const served = (await response?.text()) ?? '';
        expect(served).not.toContain('class="btn btn"');
        expect(served).toContain('class="btn"');
    });
});
