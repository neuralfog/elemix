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

        // initial
        expect(read('.ticks')).toBe('0');
        expect(read('.count')).toBe('0');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A']);

        // tick() calls a method that mutates a PRIVATE #field on a raw class
        // instance: it must NOT throw (proxy would), and it must NOT be reactive
        clickSel('.tick');
        clickSel('.tick');
        clickSel('.tick');
        expect(read('.ticks')).toBe('0'); // raw value changed, but view is stale

        // manual render() re-reads the raw value
        clickSel('.refresh');
        expect(read('.ticks')).toBe('3');

        // normal reactive state still auto-updates
        clickSel('.inc');
        expect(read('.count')).toBe('1');

        // a reactive update of `count` does NOT re-read the independent raw
        // ticks binding — they are separate effects
        clickSel('.tick'); // raw now 4, still shows 3
        clickSel('.inc');
        expect(read('.count')).toBe('2');
        expect(read('.ticks')).toBe('3');

        // refresh reflects the latest raw value
        clickSel('.refresh');
        expect(read('.ticks')).toBe('4');

        // reactive list still works (toRaw key path coexists with user raw())
        clickSel('.add-row');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A', 'B']);
        expect(list('ul.rows li.row .rid')).toEqual(['a', 'b']);
    },
};
