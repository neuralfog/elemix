import { expect, test } from '@playwright/test';

test.describe('PropsApp', () => {
    test('all prop types cross the SSR boundary; function props invoke callbacks after hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/props-app');
        const served = (await response?.text()) ?? '';
        // serializable props (string/number/boolean/array) SSR into the child
        expect(served).toContain('>hello</span>');
        expect(served).toContain('class="flag">yes</span>');
        expect(served).toContain('class="tags">a</span>');
        // data-h carries the serializable subset (functions are dropped by JSON)
        expect(served).toContain('data-h=');

        await page.waitForFunction(
            () =>
                !!customElements.get('props-app') &&
                !!customElements.get('props-child'),
        );

        const label = page.locator('props-app props-child .label');
        const count = page.locator('props-app props-child .count');
        const flag = page.locator('props-app props-child .flag');
        const tags = page.locator('props-app props-child .tags');
        const pcount = page.locator('props-app .parent .pcount');
        const ptags = page.locator('props-app .parent .ptags');
        const bump = page.locator('props-app props-child .bump');
        const add = page.locator('props-app props-child .add');

        await expect(label).toHaveText('hello');
        await expect(count).toHaveText('0');
        await expect(flag).toHaveText('yes');
        await expect(tags).toHaveText('a');
        await expect(pcount).toHaveText('0');
        await expect(ptags).toHaveText('a');

        // function prop invoked from the child -> parent count++ -> reactive :count
        // prop flows back into the child
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

        // the child mutates the SHARED array prop DIRECTLY (props.tags.push) -> the
        // parent, reading the same reactive array, updates too
        await page.locator('props-app props-child .push').click();
        await expect(tags).toHaveText('a,x,x,y');
        await expect(ptags).toHaveText('a,x,x,y');
    });
});
