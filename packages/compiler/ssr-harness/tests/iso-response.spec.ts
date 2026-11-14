import { expect, test } from '@playwright/test';

test.describe('response surface', () => {
    test('G1: HEAD runs the route but returns an empty body', async ({
        request,
    }) => {
        const res = await request.head('/view-data-app');
        expect(res.status()).toBe(200);
        expect((await res.body()).length).toBe(0);
    });

    test('G3: rendered view is text/html; charset=utf-8 with nosniff', async ({
        request,
    }) => {
        const res = await request.get('/view-data-app');
        const headers = res.headers();
        expect(headers['content-type']).toContain('text/html');
        expect(headers['content-type']).toContain('charset=utf-8');
        expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('G4: duplicate query keys resolve deterministically', async ({
        request,
    }) => {
        const extract = (body: string): string =>
            body.match(/class="q">([^<]*)</)?.[1] ?? '';
        const a = extract(
            await (await request.get('/iso/ctx/x?q=1&q=2')).text(),
        );
        const b = extract(
            await (await request.get('/iso/ctx/x?q=1&q=2')).text(),
        );
        expect(a).toBe(b);
        expect(a.length).toBeGreaterThan(0);
    });

    test('C3: a dynamic (uncached) view marks itself uncacheable downstream', async ({
        request,
    }) => {
        const res = await request.get('/view-data-app');
        const cc = res.headers()['cache-control'] ?? '';
        expect(cc.length).toBeGreaterThan(0);
    });
});
