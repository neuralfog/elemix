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

        expect(read('.city')).toBe('London');
        expect(read('.lat')).toBe('51');
        expect(read('.lng')).toBe('0');
        expect(read('.tags')).toBe('a,b');
        expect(read('.grid')).toBe('1|2 3|4');
        expect(read('.cell')).toBe('2');
        expect(read('.groups-str')).toBe('g0(write)');
        expect(col('gid')).toEqual(['g0']);
        expect(col('tcount')).toEqual(['1']);

        await click('.rename-city');
        expect(read('.city')).toBe('Paris');

        await click('.move-lat');
        expect(read('.lat')).toBe('52');

        await click('.replace-geo');
        expect(read('.lat')).toBe('99');
        expect(read('.lng')).toBe('99');

        await click('.add-tag');
        expect(read('.tags')).toBe('a,b,c');

        await click('.set-cell');
        expect(read('.cell')).toBe('9');
        expect(read('.grid')).toBe('1|9 3|4');

        await click('.push-col');
        expect(read('.grid')).toBe('1|9|5 3|4');
        expect(read('.cell')).toBe('9');

        await click('.add-row');
        expect(read('.grid')).toBe('1|9|5 3|4 7|8');

        await click('.toggle-task');
        expect(read('.groups-str')).toBe('g0(write!)');

        await click('.add-task');
        expect(read('.groups-str')).toBe('g0(write!,review)');
        expect(col('tcount')).toEqual(['2']);

        await click('.add-group');
        expect(read('.groups-str')).toBe('g0(write!,review) g1()');
        expect(col('gid')).toEqual(['g0', 'g1']);
        expect(col('tcount')).toEqual(['2', '0']);
    },
};
