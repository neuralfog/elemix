import { expect, test } from '@playwright/test';

test.describe('SsrPropsAppClientChild', () => {
    test('SSR parent hydrates; #client child renders fresh on the client; every prop type crosses the boundary and callbacks stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/ssr-props-app-client-child');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('class="pcount">0</span>');
        expect(served).toContain('class="ptags">a</span>');
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

        await expect(label).toHaveText('hello');
        await expect(count).toHaveText('0');
        await expect(flag).toHaveText('yes');
        await expect(tags).toHaveText('a');
        await expect(pcount).toHaveText('0');
        await expect(ptags).toHaveText('a');

        await bump.click();
        await expect(pcount).toHaveText('1');
        await expect(count).toHaveText('1');
        await bump.click();
        await expect(pcount).toHaveText('2');
        await expect(count).toHaveText('2');

        await add.click();
        await expect(ptags).toHaveText('a,x');
        await expect(tags).toHaveText('a,x');
        await add.click();
        await expect(ptags).toHaveText('a,x,x');
        await expect(tags).toHaveText('a,x,x');

        await page.locator('ssr-props-app-client-child .push').click();
        await expect(tags).toHaveText('a,x,x,y');
        await expect(ptags).toHaveText('a,x,x,y');
    });
});
