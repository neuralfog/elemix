import { expect, test } from '@playwright/test';

test.describe('code tabs (verbatim pre content)', () => {
    test('SSR renders the pre code block byte-for-byte, whitespace and tags intact', async ({
        page,
    }) => {
        const res = await page.goto('/code-tabs-app');
        const html = (await res?.text()) ?? '';

        expect(html).toContain(
            '<code><span class="k">import</span> x <span class="k">from</span> <span class="s">\'y\'</span>;\n<span class="c">// #state</span>\n    count = <span class="n">0</span>;</code>',
        );
        expect(html).toContain(
            '<code><span class="t">button</span> {\n    color: <span class="n">#fff</span>;\n}</code>',
        );
    });

    test('SSR seeds the active panel via the reactive class binding', async ({
        page,
    }) => {
        const res = await page.goto('/code-tabs-app');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('id="panel-ts" class="panel"');
        expect(html).toContain('id="panel-scss" class="panel hidden"');
    });
});
