import { expect, test } from '@playwright/test';

const token = (n: number): string => `isotok-${String(n).padStart(3, '0')}`;
const TOKENS = Array.from({ length: 40 }, (_, i) => token(i));

const containsNoForeignToken = (body: string, own: string): void => {
    for (const other of TOKENS) {
        if (other !== own) expect(body).not.toContain(other);
    }
};

test.describe('render isolation (adversarial)', () => {
    test('context: param + query echo only this request, concurrent fan-out', async ({
        request,
    }) => {
        const bodies = await Promise.all(
            TOKENS.map(async (t) => {
                const res = await request.get(`/iso/ctx/${t}?q=q-${t}`);
                expect(res.ok()).toBeTruthy();
                return { t, body: await res.text() };
            }),
        );

        for (const { t, body } of bodies) {
            expect(body).toContain(`>${t}<`);
            expect(body).toContain(`>q-${t}<`);
            containsNoForeignToken(body, t);
        }
    });

    test('context: interleaved sequential requests do not bleed', async ({
        request,
    }) => {
        for (let round = 0; round < 3; round++) {
            for (const t of TOKENS) {
                const body = await (
                    await request.get(`/iso/ctx/${t}?q=q-${t}`)
                ).text();
                expect(body).toContain(`>${t}<`);
                containsNoForeignToken(body, t);
            }
        }
    });

    test('module #state never accumulates or bleeds across requests (I1)', async ({
        request,
    }) => {
        for (const t of TOKENS) {
            const body = await (await request.get(`/iso/module/${t}`)).text();
            expect(body).toContain('class="count">1<');
            expect(body).toContain(`>${t}<`);
            containsNoForeignToken(body, t);
        }

        const bodies = await Promise.all(
            TOKENS.map(async (t) => ({
                t,
                body: await (await request.get(`/iso/module/${t}`)).text(),
            })),
        );

        for (const { t, body } of bodies) {
            expect(body).toContain('class="count">1<');
            containsNoForeignToken(body, t);
        }
    });

    test('module #state stays at count 1 even when the same engine is hammered', async ({
        request,
    }) => {
        const bodies = await Promise.all(
            Array.from({ length: 80 }, (_, i) => token(i % TOKENS.length)).map(
                async (t) => ({
                    t,
                    body: await (await request.get(`/iso/module/${t}`)).text(),
                }),
            ),
        );

        for (const { body } of bodies) {
            expect(body).toContain('class="count">1<');
        }
    });

    test('viewData does not bleed between concurrent distinct routes', async ({
        request,
    }) => {
        const plan = Array.from({ length: 40 }, (_, i) =>
            i % 2 === 0
                ? { path: '/view-data-app', own: 'Ada', foreign: 'buried' }
                : {
                      path: '/view-data-rich-app',
                      own: 'buried',
                      foreign: 'Ada',
                  },
        );

        const bodies = await Promise.all(
            plan.map(async (p) => ({
                p,
                body: await (await request.get(p.path)).text(),
            })),
        );

        for (const { p, body } of bodies) {
            expect(body).toContain(p.own);
            expect(body).not.toContain(p.foreign);
        }
    });
});
