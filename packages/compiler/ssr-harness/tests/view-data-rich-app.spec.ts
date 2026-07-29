import { expect, test } from '@playwright/test';

test.describe('ViewDataRichApp', () => {
    test('viewData carries primitives, null, arrays, nested objects and arrays of objects across SSR and hydration', async ({
        page,
    }) => {
        const response = await page.goto('/view-data-rich-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="str">hello</span>');
        expect(served).toContain('class="num">42</span>');
        expect(served).toContain('class="bool">yes</span>');
        expect(served).toContain('class="nil">none</span>');
        expect(served).toContain('class="tags">a,b,c</span>');
        expect(served).toContain('class="scores-len">4</span>');
        expect(served).toContain('class="scores-sum">10</span>');
        expect(served).toContain('class="obj-a">x</span>');
        expect(served).toContain('class="obj-b">7</span>');
        expect(served).toContain('class="deep">buried</span>');

        await page.waitForFunction(() =>
            customElements.get('view-data-rich-app'),
        );

        const q = (c: string) => page.locator(`view-data-rich-app ${c}`);
        await expect(q('.str')).toHaveText('hello');
        await expect(q('.num')).toHaveText('42');
        await expect(q('.bool')).toHaveText('yes');
        await expect(q('.nil')).toHaveText('none');
        await expect(q('.tags')).toHaveText('a,b,c');
        await expect(q('.scores-len')).toHaveText('4');
        await expect(q('.scores-sum')).toHaveText('10');
        await expect(q('.obj-a')).toHaveText('x');
        await expect(q('.obj-b')).toHaveText('7');
        await expect(q('.deep')).toHaveText('buried');

        const rows = q('.rows .row');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toHaveText('1:one');
        await expect(rows.nth(1)).toHaveText('2:two');
    });
});
