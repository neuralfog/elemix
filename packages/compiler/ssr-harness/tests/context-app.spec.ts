import { expect, test } from '@playwright/test';

const TOKEN = /^[A-Za-z0-9_-]{80,}$/;

test.describe('ContextApp (ambient request context)', () => {
    test('params/query/csrf SSR, survive hydrate, and re-read on soft-nav while csrf stays a valid per-response token', async ({
        page,
    }) => {
        const res = await page.goto('/context/alpha?q=one');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('id="__hydris_context"');
        expect(html).toContain('>alpha<');
        expect(html).toContain('>one<');
        expect(html).not.toContain('stub-csrf-token');

        await page.waitForFunction(
            () => !!customElements.get('nav-link'),
            undefined,
            {
                timeout: 10_000,
            },
        );

        const root = page.locator('context-app');
        await expect(root.locator('.id')).toHaveText('alpha');
        await expect(root.locator('.q')).toHaveText('one');

        const token = (
            (await root.locator('.csrf').textContent()) ?? ''
        ).trim();
        expect(token).toMatch(TOKEN);
        expect(html).toContain(token);

        const islandToken = await page.evaluate(() => {
            const el = document.getElementById('__hydris_context');
            return el ? JSON.parse(el.textContent ?? '{}').csrf : null;
        });
        expect(islandToken).toBe(token);

        const cookies = await page.context().cookies();
        const csrfCookie = cookies.find((c) => c.name === 'hydris_csrf');
        expect(csrfCookie, 'hydris_csrf cookie present').toBeDefined();
        expect(csrfCookie?.httpOnly).toBe(true);

        const softNav = await page.evaluate(
            () => typeof document.body.setHTMLUnsafe === 'function',
        );
        test.skip(!softNav, 'setHTMLUnsafe unsupported');

        await page.locator('#to-beta').click();

        await expect(root.locator('.id')).toHaveText('beta');
        await expect(root.locator('.q')).toHaveText('two');
        await expect(root.locator('.csrf')).toHaveText(TOKEN);

        await page.locator('#to-alpha').click();
        await expect(root.locator('.id')).toHaveText('alpha');
        await expect(root.locator('.q')).toHaveText('one');
        await expect(root.locator('.csrf')).toHaveText(TOKEN);
    });

    test('missing param/query fall back cleanly and csrf is a real token', async ({
        page,
    }) => {
        await page.goto('/context/solo');
        await page.waitForFunction(
            () => !!customElements.get('context-app'),
            undefined,
            {
                timeout: 10_000,
            },
        );
        const root = page.locator('context-app');
        await expect(root.locator('.id')).toHaveText('solo');
        await expect(root.locator('.q')).toHaveText('-');
        expect(
            ((await root.locator('.csrf').textContent()) ?? '').trim(),
        ).toMatch(TOKEN);
    });
});
