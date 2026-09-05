import { expect, test } from '@playwright/test';

test('collection-app: reactive Set/Map/WeakSet/WeakMap in state', async ({
    page,
}) => {
    await page.goto('/view/collection-app');
    const t = (sel: string) => page.locator(sel);

    await expect(t('.set-size')).toHaveText('2');
    await expect(t('.set-has')).toHaveText('false');
    await expect(t('.set-keys')).toHaveText('new,featured');
    await expect(t('.set-values')).toHaveText('new,featured');
    await expect(t('.set-entries')).toHaveText('new=new,featured=featured');
    await expect(t('.set-iter')).toHaveText('new,featured');
    await expect(t('.set-foreach')).toHaveText('new,featured');
    await expect(t('.map-size')).toHaveText('1');
    await expect(t('.map-get')).toHaveText('10');
    await expect(t('.map-has')).toHaveText('true');
    await expect(t('.map-keys')).toHaveText('alice');
    await expect(t('.map-values')).toHaveText('10');
    await expect(t('.map-entries')).toHaveText('alice=10');
    await expect(t('.map-iter')).toHaveText('alice=10');
    await expect(t('.map-total')).toHaveText('10');
    await expect(t('.ws-has')).toHaveText('false');
    await expect(t('.wm-has')).toHaveText('false');
    await expect(t('.wm-get')).toHaveText('');
    await expect(t('ul.tags li')).toHaveText(['new', 'featured']);
    await expect(t('ul.scores li')).toHaveText(['alice: 10']);

    await t('.add-tag').click();
    await expect(t('.set-size')).toHaveText('3');
    await expect(t('.set-has')).toHaveText('true');
    await expect(t('.set-keys')).toHaveText('new,featured,vip');
    await expect(t('.set-values')).toHaveText('new,featured,vip');
    await expect(t('.set-entries')).toHaveText(
        'new=new,featured=featured,vip=vip',
    );
    await expect(t('.set-iter')).toHaveText('new,featured,vip');
    await expect(t('.set-foreach')).toHaveText('new,featured,vip');
    await expect(t('ul.tags li')).toHaveText(['new', 'featured', 'vip']);

    await t('.add-tag').click();
    await expect(t('.set-size')).toHaveText('3');
    await expect(t('.set-keys')).toHaveText('new,featured,vip');

    await t('.remove-tag').click();
    await expect(t('.set-size')).toHaveText('2');
    await expect(t('.set-has')).toHaveText('false');
    await expect(t('.set-keys')).toHaveText('new,featured');
    await expect(t('ul.tags li')).toHaveText(['new', 'featured']);

    await t('.clear-tags').click();
    await expect(t('.set-size')).toHaveText('0');
    await expect(t('.set-has')).toHaveText('false');
    await expect(t('.set-keys')).toHaveText('');
    await expect(t('.set-values')).toHaveText('');
    await expect(t('.set-entries')).toHaveText('');
    await expect(t('.set-iter')).toHaveText('');
    await expect(t('.set-foreach')).toHaveText('');
    await expect(t('ul.tags li')).toHaveCount(0);

    await t('.bump-alice').click();
    await expect(t('.map-size')).toHaveText('1');
    await expect(t('.map-get')).toHaveText('11');
    await expect(t('.map-keys')).toHaveText('alice');
    await expect(t('.map-values')).toHaveText('11');
    await expect(t('.map-entries')).toHaveText('alice=11');
    await expect(t('.map-iter')).toHaveText('alice=11');
    await expect(t('.map-total')).toHaveText('11');
    await expect(t('ul.scores li')).toHaveText(['alice: 11']);

    await t('.set-bob').click();
    await expect(t('.map-size')).toHaveText('2');
    await expect(t('.map-keys')).toHaveText('alice,bob');
    await expect(t('.map-values')).toHaveText('11,5');
    await expect(t('.map-entries')).toHaveText('alice=11,bob=5');
    await expect(t('.map-iter')).toHaveText('alice=11,bob=5');
    await expect(t('.map-total')).toHaveText('16');
    await expect(t('ul.scores li')).toHaveText(['alice: 11', 'bob: 5']);

    await t('.bump-alice').click();
    await expect(t('.map-get')).toHaveText('12');
    await expect(t('.map-values')).toHaveText('12,5');
    await expect(t('.map-total')).toHaveText('17');
    await expect(t('ul.scores li')).toHaveText(['alice: 12', 'bob: 5']);

    await t('.del-alice').click();
    await expect(t('.map-size')).toHaveText('1');
    await expect(t('.map-get')).toHaveText('');
    await expect(t('.map-has')).toHaveText('false');
    await expect(t('.map-keys')).toHaveText('bob');
    await expect(t('.map-values')).toHaveText('5');
    await expect(t('.map-total')).toHaveText('5');
    await expect(t('ul.scores li')).toHaveText(['bob: 5']);

    await t('.clear-scores').click();
    await expect(t('.map-size')).toHaveText('0');
    await expect(t('.map-get')).toHaveText('');
    await expect(t('.map-keys')).toHaveText('');
    await expect(t('.map-values')).toHaveText('');
    await expect(t('.map-entries')).toHaveText('');
    await expect(t('.map-total')).toHaveText('0');
    await expect(t('ul.scores li')).toHaveCount(0);

    await t('.add-seen').click();
    await expect(t('.ws-has')).toHaveText('true');
    await t('.del-seen').click();
    await expect(t('.ws-has')).toHaveText('false');

    await t('.set-meta').click();
    await expect(t('.wm-has')).toHaveText('true');
    await expect(t('.wm-get')).toHaveText('hello');
    await t('.del-meta').click();
    await expect(t('.wm-has')).toHaveText('false');
    await expect(t('.wm-get')).toHaveText('');
});
