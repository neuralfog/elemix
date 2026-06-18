import { expect, userEvent } from 'storybook/test';
import './.emited/RawApp';

export default { title: 'Compiled/RawApp' };

export const Default = {
    render: () => '<raw-app></raw-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('raw-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('raw-app did not render');

        const read = (sel: string): string =>
            root.querySelector(sel)?.textContent ?? '';
        const list = (sel: string): string[] =>
            [...root.querySelectorAll(sel)].map((el) => el.textContent ?? '');
        const click = async (sel: string): Promise<void> => {
            const btn = root.querySelector(sel);
            if (!btn) throw new Error(`missing button ${sel}`);
            await userEvent.click(btn);
        };

        // initial
        expect(read('.ticks')).toBe('0');
        expect(read('.count')).toBe('0');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A']);

        // tick() calls a method that mutates a PRIVATE #field on a raw class
        // instance: it must NOT throw (proxy would), and it must NOT be reactive
        await click('.tick');
        await click('.tick');
        await click('.tick');
        expect(read('.ticks')).toBe('0'); // raw value changed, but view is stale

        // manual render() re-reads the raw value
        await click('.refresh');
        expect(read('.ticks')).toBe('3');

        // normal reactive state still auto-updates
        await click('.inc');
        expect(read('.count')).toBe('1');

        // a reactive update of `count` does NOT re-read the independent raw
        // ticks binding — they are separate effects
        await click('.tick'); // raw now 4, still shows 3
        await click('.inc');
        expect(read('.count')).toBe('2');
        expect(read('.ticks')).toBe('3');

        // refresh reflects the latest raw value
        await click('.refresh');
        expect(read('.ticks')).toBe('4');

        // reactive list still works (toRaw key path coexists with user raw())
        await click('.add-row');
        expect(list('ul.rows li.row .rlabel')).toEqual(['A', 'B']);
        expect(list('ul.rows li.row .rid')).toEqual(['a', 'b']);
    },
};
