import { expect, test } from '@playwright/test';

test.describe('SsrPropsAppClientChild', () => {
    test('SSR parent hydrates; #client child renders fresh on the client; every prop type crosses the boundary and callbacks stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-props-app-client-child');
        const served = (await response?.text()) ?? '';
        // the SSR parent renders its own readouts server-side
        expect(served).toContain('class="pcount">0</span>');
        expect(served).toContain('class="ptags">a</span>');
        // the #client child does NOT render server-side: no child content in the
        // served markup, just a bare element carrying its serializable props
        expect(served).toContain('data-h=');
        expect(served).not.toContain('class="child"');
        expect(served).not.toContain('class="label"');

        await page.waitForFunction(
            () =>
                !!customElements.get('ssr-props-app-client-child') &&
                !!customElements.get('ssr-props-child'),
        );

        const label = page.locator('ssr-props-app-client-child .label');
        const count = page.locator('ssr-props-app-client-child .count');
        const flag = page.locator('ssr-props-app-client-child .flag');
        const tags = page.locator('ssr-props-app-client-child .tags');
        const pcount = page.locator(
            'ssr-props-app-client-child .parent .pcount',
        );
        const ptags = page.locator('ssr-props-app-client-child .parent .ptags');
        const bump = page.locator('ssr-props-app-client-child .bump');
        const add = page.locator('ssr-props-app-client-child .add');

        // the client-mounted child shows every prop type
        await expect(label).toHaveText('hello');
        await expect(count).toHaveText('0');
        await expect(flag).toHaveText('yes');
        await expect(tags).toHaveText('a');
        await expect(pcount).toHaveText('0');
        await expect(ptags).toHaveText('a');

        // function prop invoked from the client child -> parent count++ -> the
        // reactive :count prop flows back into the child
        await bump.click();
        await expect(pcount).toHaveText('1');
        await expect(count).toHaveText('1');
        await bump.click();
        await expect(pcount).toHaveText('2');
        await expect(count).toHaveText('2');

        // function prop with an argument -> parent array grows, shared into child
        await add.click();
        await expect(ptags).toHaveText('a,x');
        await expect(tags).toHaveText('a,x');
        await add.click();
        await expect(ptags).toHaveText('a,x,x');
        await expect(tags).toHaveText('a,x,x');

        // the client child mutates the SHARED array prop directly (props.tags.push)
        // -> the SSR parent, reading the same reactive array, updates too
        await page.locator('ssr-props-app-client-child .push').click();
        await expect(tags).toHaveText('a,x,x,y');
        await expect(ptags).toHaveText('a,x,x,y');
    });
});
