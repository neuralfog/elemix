import { expect, test } from '@playwright/test';

const PAYLOADS = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(2)>',
    '</script><script>alert(3)</script>',
    "';alert(4)//",
    '<svg/onload=alert(5)>',
];

test.describe('XSS escaping (adversarial payloads via request)', () => {
    for (const payload of PAYLOADS) {
        test(`payload is neutralized in text/attr/island: ${payload}`, async ({
            request,
        }) => {
            const res = await request.get(
                `/attack/${encodeURIComponent(payload)}`,
            );
            expect(res.ok()).toBeTruthy();
            const body = await res.text();

            expect(body).not.toContain('<script>alert');
            expect(body).not.toContain('<svg/onload');
            expect(body).not.toContain('<svg onload');
            expect(body).not.toContain('<img');
            expect(body).not.toContain('</script><script>');
        });
    }

    test('a known payload is present but escaped (proves the hole was exercised)', async ({
        request,
    }) => {
        const body = await (
            await request.get(
                `/attack/${encodeURIComponent('<script>alert(1)</script>')}`,
            )
        ).text();
        expect(body).toContain('&lt;script&gt;');
    });
});
