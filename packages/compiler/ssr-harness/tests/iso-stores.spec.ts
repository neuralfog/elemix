import { expect, test } from '@playwright/test';

const seed = (value: string): string =>
    `store.probe=${encodeURIComponent(value)}`;

test.describe('store cookie seed (unsigned, attacker-controlled)', () => {
    test('S1: a store.* cookie is seeded into the stores island', async ({
        request,
    }) => {
        const res = await request.get('/counter-app', {
            headers: { Cookie: seed('{"n":42424242}') },
        });
        const body = await res.text();
        expect(body).toContain('__hydris_stores');
        expect(body).toContain('42424242');
    });

    test('S1: a hostile store value cannot break out of the island', async ({
        request,
    }) => {
        const res = await request.get('/counter-app', {
            headers: {
                Cookie: `store.x=${encodeURIComponent('{"v":"</script><script>alert(1)</script>"}')}`,
            },
        });
        const body = await res.text();
        expect(body).not.toContain('</script><script>alert(1)');
    });

    test('S2: a __proto__ store seed does not pollute Object.prototype', async ({
        request,
    }) => {
        const res = await request.get('/pollution-probe', {
            headers: {
                Cookie: `store.x=${encodeURIComponent('{"a":[{"__proto__":{"polluted":"yes"}}]}')}`,
            },
        });
        const body = await res.text();
        expect(body).toContain('>clean<');
        expect(body).not.toContain('POLLUTED');
    });

    test('S4: the server never persists a store.* cookie back to the client', async ({
        request,
    }) => {
        const res = await request.get('/counter-app', {
            headers: { Cookie: seed('{"n":42424242}') },
        });
        const setCookie = res
            .headersArray()
            .filter((h) => h.name.toLowerCase() === 'set-cookie');
        for (const h of setCookie) {
            expect(h.value).not.toContain('store.');
        }
    });
});
