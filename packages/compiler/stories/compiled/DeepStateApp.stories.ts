import { expect } from '@neuralfog/elemix-testing-library';
import { click as clickEl } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/DeepStateApp';

export default { title: 'Compiled/DeepStateApp' };

export const Default = {
    render: () => '<deep-state-app></deep-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const read = (sel: string): string =>
            find(sel, canvasElement)?.textContent ?? '';
        const col = (cls: string): string[] =>
            [...query(`ul.group-list li.group .${cls}`, canvasElement)].map(
                (el) => el.textContent ?? '',
            );
        const click = async (sel: string): Promise<void> => {
            const btn = find(sel, canvasElement);
            if (!btn) throw new Error(`missing button ${sel}`);
            clickEl(btn);
        };

        // ----- initial deep reads -----
        expect(read('.city')).toBe('London'); // profile.address.city  (depth 3)
        expect(read('.lat')).toBe('51'); // profile.address.geo.lat (depth 4)
        expect(read('.lng')).toBe('0');
        expect(read('.tags')).toBe('a,b'); // object -> array
        expect(read('.grid')).toBe('1|2 3|4'); // array of arrays
        expect(read('.cell')).toBe('2'); // grid[0][1]
        expect(read('.groups-str')).toBe('g0(write)'); // arr -> obj -> arr -> obj
        expect(col('gid')).toEqual(['g0']);
        expect(col('tcount')).toEqual(['1']);

        // ----- depth-3 object leaf write -----
        await click('.rename-city');
        expect(read('.city')).toBe('Paris');

        // ----- depth-4 leaf increment -----
        await click('.move-lat');
        expect(read('.lat')).toBe('52');

        // ----- replace a nested subtree (address.geo = {...}) -----
        await click('.replace-geo');
        expect(read('.lat')).toBe('99');
        expect(read('.lng')).toBe('99');

        // ----- nested array (object -> array) push -----
        await click('.add-tag');
        expect(read('.tags')).toBe('a,b,c');

        // ----- 2D array: inner element set (the newly-tracked path) -----
        await click('.set-cell');
        expect(read('.cell')).toBe('9');
        expect(read('.grid')).toBe('1|9 3|4');

        // ----- 2D array: inner push -----
        await click('.push-col');
        expect(read('.grid')).toBe('1|9|5 3|4');
        expect(read('.cell')).toBe('9'); // grid[0][1] unchanged by the append

        // ----- 2D array: outer push -----
        await click('.add-row');
        expect(read('.grid')).toBe('1|9|5 3|4 7|8');

        // ----- deep array-of-objects: toggle a leaf at arr->obj->arr->obj -----
        await click('.toggle-task');
        expect(read('.groups-str')).toBe('g0(write!)');

        // ----- deep nested array push (groups[0].tasks.push) -----
        await click('.add-task');
        expect(read('.groups-str')).toBe('g0(write!,review)');
        expect(col('tcount')).toEqual(['2']); // group.tasks.length inside a repeat row

        // ----- outer array-of-objects push -----
        await click('.add-group');
        expect(read('.groups-str')).toBe('g0(write!,review) g1()');
        expect(col('gid')).toEqual(['g0', 'g1']);
        expect(col('tcount')).toEqual(['2', '0']);
    },
};
