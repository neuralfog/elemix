import { expect, test } from '@playwright/test';

test.describe('CollectionApp', () => {
    test('Set / Map / WeakSet / WeakMap in state hydrate and stay reactive', async ({
        page,
    }) => {
        const response = await page.goto('/collection-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('new,featured');
        expect(served).toContain('alice=10');

        await page.waitForFunction(
            () => !!customElements.get('collection-app'),
        );

        const read = (sel: string) => page.locator(`collection-app ${sel}`);
        const list = (sel: string) => page.locator(`collection-app ${sel}`);
        const click = (sel: string) =>
            page.locator(`collection-app ${sel}`).click();

        await expect(read('.set-size')).toHaveText('2');
        await expect(read('.set-has')).toHaveText('false');
        await expect(read('.set-keys')).toHaveText('new,featured');
        await expect(read('.set-entries')).toHaveText(
            'new=new,featured=featured',
        );
        await expect(read('.set-foreach')).toHaveText('new,featured');
        await expect(read('.map-size')).toHaveText('1');
        await expect(read('.map-get')).toHaveText('10');
        await expect(read('.map-has')).toHaveText('true');
        await expect(read('.map-entries')).toHaveText('alice=10');
        await expect(read('.map-total')).toHaveText('10');
        await expect(read('.ws-has')).toHaveText('false');
        await expect(read('.wm-has')).toHaveText('false');
        await expect(read('.wm-get')).toHaveText('');
        await expect(list('ul.tags li')).toHaveText(['new', 'featured']);
        await expect(list('ul.scores li')).toHaveText(['alice: 10']);

        await click('.add-tag');
        await expect(read('.set-size')).toHaveText('3');
        await expect(read('.set-has')).toHaveText('true');
        await expect(read('.set-keys')).toHaveText('new,featured,vip');
        await expect(list('ul.tags li')).toHaveText(['new', 'featured', 'vip']);

        await click('.add-tag');
        await expect(read('.set-size')).toHaveText('3');

        await click('.remove-tag');
        await expect(read('.set-size')).toHaveText('2');
        await expect(read('.set-keys')).toHaveText('new,featured');

        await click('.clear-tags');
        await expect(read('.set-size')).toHaveText('0');
        await expect(read('.set-keys')).toHaveText('');
        await expect(list('ul.tags li')).toHaveText([]);

        await click('.bump-alice');
        await expect(read('.map-get')).toHaveText('11');
        await expect(read('.map-total')).toHaveText('11');
        await expect(list('ul.scores li')).toHaveText(['alice: 11']);

        await click('.set-bob');
        await expect(read('.map-size')).toHaveText('2');
        await expect(read('.map-entries')).toHaveText('alice=11,bob=5');
        await expect(read('.map-total')).toHaveText('16');
        await expect(list('ul.scores li')).toHaveText(['alice: 11', 'bob: 5']);

        await click('.del-alice');
        await expect(read('.map-size')).toHaveText('1');
        await expect(read('.map-get')).toHaveText('');
        await expect(read('.map-has')).toHaveText('false');
        await expect(read('.map-total')).toHaveText('5');
        await expect(list('ul.scores li')).toHaveText(['bob: 5']);

        await click('.clear-scores');
        await expect(read('.map-size')).toHaveText('0');
        await expect(read('.map-total')).toHaveText('0');
        await expect(list('ul.scores li')).toHaveText([]);

        await click('.add-seen');
        await expect(read('.ws-has')).toHaveText('true');
        await click('.del-seen');
        await expect(read('.ws-has')).toHaveText('false');

        await click('.set-meta');
        await expect(read('.wm-has')).toHaveText('true');
        await expect(read('.wm-get')).toHaveText('hello');
        await click('.del-meta');
        await expect(read('.wm-has')).toHaveText('false');
        await expect(read('.wm-get')).toHaveText('');
    });
});
