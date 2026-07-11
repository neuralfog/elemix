import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/InterpApp';

export default { title: 'Compiled/InterpApp' };

export const Default = {
    render: () => '<interp-app></interp-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const full = find('.full', canvasElement);
        const dash = find('.dash', canvasElement);
        const middle = find('.middle', canvasElement);
        const num = find('.num', canvasElement);
        if (!full || !dash || !middle || !num)
            throw new Error('interp-app missing .full/.dash/.middle/.num');

        // buttons in DOM order: swap, set middle, inc
        const buttons = query('button', canvasElement);
        const swapBtn = buttons[0];
        const setMiddleBtn = buttons[1];
        const incBtn = buttons[2];

        // initial: first Ada, last Lovelace
        // .full -> adjacent holes, NO space between them
        expect(full.textContent).toBe('full: AdaLovelace');
        // .dash -> holes separated by static "-"
        expect(dash.textContent).toBe('dash: Ada-Lovelace');
        // .middle -> null renders empty between the static brackets
        expect(middle.textContent).toBe('middle: []');
        // .num -> numeric hole
        expect(num.textContent).toBe('num: 0');

        // inc -> n: 0 -> 1 -> 2 (numeric hole reactivity, asserted each step)
        click(incBtn);
        expect(num.textContent).toBe('num: 1');
        click(incBtn);
        expect(num.textContent).toBe('num: 2');

        // set middle -> null becomes 'M' (renders between brackets)
        click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: [M]');
        // set middle again -> 'M' toggles back to null (empty)
        click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: []');

        // swap -> first/last swap; both adjacent (.full) and dash-separated (.dash) update
        click(swapBtn);
        expect(full.textContent).toBe('full: LovelaceAda');
        expect(dash.textContent).toBe('dash: Lovelace-Ada');
        // swap back -> returns to original ordering
        click(swapBtn);
        expect(full.textContent).toBe('full: AdaLovelace');
        expect(dash.textContent).toBe('dash: Ada-Lovelace');
    },
};
