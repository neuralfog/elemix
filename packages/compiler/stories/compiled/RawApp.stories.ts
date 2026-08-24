import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/RawApp';

export default { title: 'Compiled/RawApp' };

export const Default = {
    render: () => '<raw-app></raw-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const read = (sel: string): string =>
            find(sel, canvasElement)?.textContent ?? '';
        const list = (sel: string): string[] =>
            query(sel, canvasElement).map((el) => el.textContent ?? '');
        const clickSel = (sel: string): void => {
            const btn = find(sel, canvasElement);
            if (!btn) throw new Error(`missing button ${sel}`);
            click(btn);
        };

        expect(read('.ticks')).toBe('0');
        expect(read('.count')).toBe('0');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A']);

        clickSel('.tick');
        clickSel('.tick');
        clickSel('.tick');
        expect(read('.ticks')).toBe('0');

        clickSel('.refresh');
        expect(read('.ticks')).toBe('3');

        clickSel('.inc');
        expect(read('.count')).toBe('1');

        clickSel('.tick');
        clickSel('.inc');
        expect(read('.count')).toBe('2');
        expect(read('.ticks')).toBe('3');

        clickSel('.refresh');
        expect(read('.ticks')).toBe('4');

        clickSel('.add-row');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A', 'B']);
        expect(list('ul.rows li.row .rid')).toEqual(['a', 'b']);
    },
};
