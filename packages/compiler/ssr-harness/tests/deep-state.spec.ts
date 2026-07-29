import { expect, test } from '@playwright/test';

test.describe('DeepStateApp', () => {
    test('deep nested state (objects, 2D arrays, arr->obj->arr->obj) hydrates and reacts', async ({
        page,
    }) => {
        const response = await page.goto('/deep-state-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('London');
        expect(served).toContain('g0(write)');

        await page.waitForFunction(
            () => !!customElements.get('deep-state-app'),
        );

        const read = (sel: string) => page.locator(`deep-state-app ${sel}`);
        const col = (cls: string) =>
            page.locator(`deep-state-app ul.group-list li.group .${cls}`);
        const click = (sel: string) =>
            page.locator(`deep-state-app ${sel}`).click();

        await expect(read('.city')).toHaveText('London');
        await expect(read('.lat')).toHaveText('51');
        await expect(read('.lng')).toHaveText('0');
        await expect(read('.tags')).toHaveText('a,b');
        await expect(read('.grid')).toHaveText('1|2 3|4');
        await expect(read('.cell')).toHaveText('2');
        await expect(read('.groups-str')).toHaveText('g0(write)');
        await expect(col('gid')).toHaveText(['g0']);
        await expect(col('tcount')).toHaveText(['1']);

        await click('.rename-city');
        await expect(read('.city')).toHaveText('Paris');

        await click('.move-lat');
        await expect(read('.lat')).toHaveText('52');

        await click('.replace-geo');
        await expect(read('.lat')).toHaveText('99');
        await expect(read('.lng')).toHaveText('99');

        await click('.add-tag');
        await expect(read('.tags')).toHaveText('a,b,c');

        await click('.set-cell');
        await expect(read('.cell')).toHaveText('9');
        await expect(read('.grid')).toHaveText('1|9 3|4');

        await click('.push-col');
        await expect(read('.grid')).toHaveText('1|9|5 3|4');
        await expect(read('.cell')).toHaveText('9');

        await click('.add-row');
        await expect(read('.grid')).toHaveText('1|9|5 3|4 7|8');

        await click('.toggle-task');
        await expect(read('.groups-str')).toHaveText('g0(write!)');

        await click('.add-task');
        await expect(read('.groups-str')).toHaveText('g0(write!,review)');
        await expect(col('tcount')).toHaveText(['2']);

        await click('.add-group');
        await expect(read('.groups-str')).toHaveText('g0(write!,review) g1()');
        await expect(col('gid')).toHaveText(['g0', 'g1']);
        await expect(col('tcount')).toHaveText(['2', '0']);
    });
});
