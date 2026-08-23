import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page): Promise<unknown> =>
    page.waitForFunction(() => !!customElements.get('nav-link'), undefined, {
        timeout: 10_000,
    });

const softNavSupported = (
    page: import('@playwright/test').Page,
): Promise<boolean> =>
    page.evaluate(() => typeof document.body.setHTMLUnsafe === 'function');

const mark = (page: import('@playwright/test').Page): Promise<void> =>
    page.evaluate(() => {
        (window as unknown as { __nav?: string }).__nav = 'kept';
    });

const marker = (
    page: import('@playwright/test').Page,
): Promise<string | undefined> =>
    page.evaluate(() => (window as unknown as { __nav?: string }).__nav);

test.describe('soft navigation (nav-link + navigate)', () => {
    test('SSR renders the document head and nav-links', async ({ page }) => {
        const res = await page.goto('/nav-home-app');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('<title>Home</title>');
        expect(html).toContain('content="home"');
        expect(html).toContain('route="/nav-about-app"');
        expect(html).toContain('id="nav-style"');
    });

    test('nav-link soft-navigates without a full reload; swaps body + title', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');
        await mark(page);

        await page.click('#to-about');
        await page.waitForFunction(
            () => location.pathname === '/nav-about-app',
        );

        expect(await marker(page)).toBe('kept');
        await expect(page.locator('#page')).toHaveAttribute(
            'data-page',
            'about',
        );
        expect(await page.title()).toBe('About');
    });

    test('head is merged: page meta swapped, shared elements kept exactly once', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#to-about');
        await page.waitForFunction(
            () => location.pathname === '/nav-about-app',
        );

        const head = await page.evaluate(() => ({
            about: document.querySelectorAll(
                'meta[name="page"][content="about"]',
            ).length,
            home: document.querySelectorAll('meta[name="page"][content="home"]')
                .length,
            style: document.querySelectorAll('#nav-style').length,
            charset: document.querySelectorAll('meta[charset]').length,
            title: document.title,
        }));

        expect(head.about).toBe(1);
        expect(head.home).toBe(0);
        expect(head.style).toBe(1);
        expect(head.charset).toBe(1);
        expect(head.title).toBe('About');
    });

    test('back/forward soft-navigates via popstate', async ({ page }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');
        await mark(page);

        await page.click('#to-about');
        await page.waitForFunction(
            () => location.pathname === '/nav-about-app',
        );
        await page.goBack();
        await page.waitForFunction(() => location.pathname === '/nav-home-app');

        expect(await marker(page)).toBe('kept');
        await expect(page.locator('#page')).toHaveAttribute(
            'data-page',
            'home',
        );
        expect(await page.title()).toBe('Home');
    });

    test('a swapped-in page hydrates (state and events work)', async ({
        page,
    }) => {
        await page.goto('/nav-about-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#to-home');
        await page.waitForFunction(() => location.pathname === '/nav-home-app');
        await page.waitForSelector('#counter');

        await expect(page.locator('#counter')).toHaveText('count 0');
        await page.click('#counter');
        await expect(page.locator('#counter')).toHaveText('count 1');
    });

    test('a plain <a> does a full reload, not a soft-nav', async ({ page }) => {
        await page.goto('/nav-about-app');
        await ready(page);
        await mark(page);

        await page.click('#hard-link');
        await page.waitForFunction(() => location.pathname === '/nav-home-app');

        expect(await marker(page)).toBeUndefined();
    });

    test('disabled nav-link does not navigate', async ({ page }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#disabled-btn', { force: true });
        await page.waitForTimeout(300);
        expect(new URL(page.url()).pathname).toBe('/nav-home-app');
    });

    test('server redirect: soft-nav lands on the redirect target URL', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');
        await mark(page);

        await page.evaluate(() => {
            const nl = document.querySelector('nav-link');
            nl?.setAttribute('route', '/nav-redirect');
            (nl?.querySelector('a') as HTMLElement | null)?.click();
        });
        await page.waitForFunction(
            () => location.pathname === '/nav-about-app',
        );

        expect(await marker(page)).toBe('kept');
        await expect(page.locator('#page')).toHaveAttribute(
            'data-page',
            'about',
        );
    });
});

const winNum = (
    page: import('@playwright/test').Page,
    key: string,
): Promise<number> =>
    page.evaluate(
        (k) => (window as unknown as Record<string, number>)[k] ?? 0,
        key,
    );

const toAbout = async (
    page: import('@playwright/test').Page,
): Promise<void> => {
    await page.click('#to-about');
    await page.waitForFunction(() => location.pathname === '/nav-about-app');
};

const toHome = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.click('#to-home');
    await page.waitForFunction(() => location.pathname === '/nav-home-app');
};

const count = (
    page: import('@playwright/test').Page,
    selector: string,
): Promise<number> =>
    page.evaluate((s) => document.head.querySelectorAll(s).length, selector);

test.describe('head merging (advanced)', () => {
    test('page-only head elements are added on nav and removed on nav-back', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        expect(await count(page, 'meta[name="about-only"]')).toBe(0);
        expect(await count(page, '#about-style')).toBe(0);

        await toAbout(page);
        expect(await count(page, 'meta[name="about-only"]')).toBe(1);
        expect(await count(page, '#about-style')).toBe(1);

        await toHome(page);
        expect(await count(page, 'meta[name="about-only"]')).toBe(0);
        expect(await count(page, '#about-style')).toBe(0);
    });

    test('unchanged head scripts are kept, never re-executed', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        expect(await winNum(page, '__headRuns')).toBe(1);
        await toAbout(page);
        await toHome(page);
        await toAbout(page);
        expect(await winNum(page, '__headRuns')).toBe(1);
        expect(await count(page, '#head-once')).toBe(1);
    });

    test('newly-added head scripts run, and re-run when re-added', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        expect(await winNum(page, '__aboutScript')).toBe(0);
        await toAbout(page);
        expect(await winNum(page, '__aboutScript')).toBe(1);
        await toHome(page);
        await toAbout(page);
        expect(await winNum(page, '__aboutScript')).toBe(2);
    });

    test('shared head elements are never duplicated across many navs', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        for (let i = 0; i < 3; i++) {
            await toAbout(page);
            await toHome(page);
        }

        expect(await count(page, 'meta[charset]')).toBe(1);
        expect(await count(page, '#nav-style')).toBe(1);
        expect(await count(page, '#head-once')).toBe(1);
        expect(await count(page, 'title')).toBe(1);
        expect(await count(page, 'meta[name="page"]')).toBe(1);
    });

    test('round-trip restores the head exactly (no drift)', async ({
        page,
    }) => {
        await page.goto('/nav-home-app');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        const snapshot = (): Promise<string> =>
            page.evaluate(() =>
                [...document.head.children]
                    .map((el) => el.outerHTML)
                    .sort()
                    .join('\n'),
            );

        const home = await snapshot();
        await toAbout(page);
        await toHome(page);
        expect(await snapshot()).toBe(home);
    });
});

const prefsCookie = (value: object): string =>
    `store.prefs=${encodeURIComponent(JSON.stringify(value))}`;

test.describe('client store SSR round-trip', () => {
    test('server seeds the store from the store cookie', async ({
        request,
    }) => {
        const res = await request.get('/nav-store-b', {
            headers: { cookie: prefsCookie({ count: 42 }) },
        });
        const html = await res.text();
        expect(html).toContain('data-count="42"');
        expect(html).toContain('window.__hydris_stores={"prefs":{"count":42}}');
    });

    test('no cookie renders the store default', async ({ request }) => {
        const res = await request.get('/nav-store-b');
        const html = await res.text();
        expect(html).toContain('data-count="0"');
    });

    test('a malformed store cookie falls back to the default', async ({
        request,
    }) => {
        const res = await request.get('/nav-store-b', {
            headers: { cookie: 'store.prefs=not%20json' },
        });
        const html = await res.text();
        expect(html).toContain('data-count="0"');
    });

    test('client mutation reaches SSR on soft-nav', async ({ page }) => {
        await page.goto('/nav-store-a');
        await ready(page);
        test.skip(!(await softNavSupported(page)), 'setHTMLUnsafe unsupported');

        await page.click('#inc');
        await page.click('#inc');
        await page.click('#inc');
        await expect(page.locator('#count-a')).toHaveText('3');

        await page.click('#to-store-b');
        await expect(page.locator('#count-b')).toHaveText('3');

        const seeded = await page.evaluate(
            () =>
                (
                    window as unknown as {
                        __hydris_stores?: { prefs?: { count?: number } };
                    }
                ).__hydris_stores?.prefs?.count,
        );
        expect(seeded).toBe(3);
    });

    test('concurrent requests never bleed the store seed across each other', async ({
        request,
    }) => {
        const results = await Promise.all(
            Array.from({ length: 40 }, (_, i) => {
                const seeded = i % 2 === 0;
                const expected = seeded ? String(i + 1) : '0';
                return request
                    .get('/nav-store-b', {
                        headers: seeded
                            ? { cookie: prefsCookie({ count: i + 1 }) }
                            : {},
                    })
                    .then((r) => r.text())
                    .then((html) => ({
                        expected,
                        counts: [...html.matchAll(/data-count="(\d+)"/g)].map(
                            (m) => m[1],
                        ),
                    }));
            }),
        );
        for (const { expected, counts } of results) {
            expect(counts).toEqual([expected]);
        }
    });
});

const readPrefsCookie = (
    page: import('@playwright/test').Page,
): Promise<string | null> =>
    page.evaluate(() => {
        const m = document.cookie.match(/(?:^|;\s*)store\.prefs=([^;]*)/);
        return m ? decodeURIComponent(m[1]) : null;
    });

test.describe('cookie store persistence', () => {
    test('the seed is not re-written; only mutations write the cookie', async ({
        page,
    }) => {
        await page.goto('/nav-store-a');
        await ready(page);
        await page.waitForTimeout(250);
        expect(await readPrefsCookie(page)).toBeNull();

        await page.click('#inc');
        await expect
            .poll(() => readPrefsCookie(page), { timeout: 5000 })
            .toContain('"count":1');
    });

    test('a store mutation writes the cookie', async ({ page }) => {
        await page.goto('/nav-store-a');
        await ready(page);
        await page.click('#inc');
        await page.click('#inc');
        await expect
            .poll(() => readPrefsCookie(page), { timeout: 5000 })
            .toContain('"count":2');
    });

    test('reload restores the store from its cookie via SSR', async ({
        page,
    }) => {
        await page.goto('/nav-store-a');
        await ready(page);

        await page.click('#inc');
        await page.click('#inc');
        await page.click('#inc');
        await expect(page.locator('#count-a')).toHaveText('3');
        await expect
            .poll(() => readPrefsCookie(page), { timeout: 5000 })
            .toContain('"count":3');

        const res = await page.reload();
        const html = (await res?.text()) ?? '';
        expect(html).toContain('data-count="3"');
        await expect(page.locator('#count-a')).toHaveText('3');
    });

    test('writing past the 4KB cookie limit throws', async ({ page }) => {
        await page.goto('/nav-store-a');
        await ready(page);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.click('#bloat');
        await expect
            .poll(() => errors.join('\n'), { timeout: 5000 })
            .toContain('cookie limit');
    });
});
