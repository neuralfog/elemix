import { expect, test } from '@playwright/test';

test.describe('Endpoint (manual route + contract, no action client)', () => {
    test('a non-action endpoint binds the contract body and returns Reply.Json', async ({
        page,
    }) => {
        await page.goto('/mx-text-hole');

        const ok = await page.evaluate(async () => {
            const token = JSON.parse(
                document.getElementById('__hydris_context')?.textContent ??
                    '{}',
            ).csrf;
            const res = await fetch('/api/greet', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-hydris-csrf': token,
                },
                body: JSON.stringify({ name: 'ada' }),
            });
            return { status: res.status, body: await res.json() };
        });

        expect(ok.status).toBe(200);
        expect(ok.body).toEqual({ message: 'hello ada', length: 3 });
    });

    test('the endpoint validates the contract and returns 400 with field codes', async ({
        page,
    }) => {
        await page.goto('/mx-text-hole');

        const short = await page.evaluate(async () => {
            const token = JSON.parse(
                document.getElementById('__hydris_context')?.textContent ??
                    '{}',
            ).csrf;
            const res = await fetch('/api/greet', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-hydris-csrf': token,
                },
                body: JSON.stringify({ name: 'a' }),
            });
            return { status: res.status, body: await res.text() };
        });

        expect(short.status).toBe(400);
        expect(short.body).toContain('"field":"name"');
        expect(short.body).toContain('"code":"between"');

        const missing = await page.evaluate(async () => {
            const token = JSON.parse(
                document.getElementById('__hydris_context')?.textContent ??
                    '{}',
            ).csrf;
            const res = await fetch('/api/greet', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-hydris-csrf': token,
                },
                body: '{}',
            });
            return { status: res.status, body: await res.text() };
        });

        expect(missing.status).toBe(400);
        expect(missing.body).toContain('"code":"required"');
    });
});
