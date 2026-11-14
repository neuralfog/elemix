import { expect, test } from '@playwright/test';

test.describe('csrf gate', () => {
    test('F2: a real csrf token is embedded in the context island', async ({
        request,
    }) => {
        const body = await (await request.get('/context/alpha?q=one')).text();
        const match = body.match(/"csrf":"([A-Za-z0-9_-]+)"/);
        expect(match?.[1]).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    });

    test('F4: an unsafe method without a csrf token is rejected', async ({
        request,
    }) => {
        const res = await request.post('/api/users', {
            data: { name: 'mallory', handle: 'm' },
        });
        expect(res.ok()).toBeFalsy();
        expect(await res.text()).toContain('CSRF');
    });
});
