import { expect, userEvent } from 'storybook/test';
import './.emited/InterpApp';

export default { title: 'Compiled/InterpApp' };

export const Default = {
    render: () => '<interp-app></interp-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('interp-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('interp-app did not render a shadow root');

        const full = root.querySelector('.full');
        const dash = root.querySelector('.dash');
        const middle = root.querySelector('.middle');
        const num = root.querySelector('.num');
        if (!full || !dash || !middle || !num)
            throw new Error('interp-app missing .full/.dash/.middle/.num');

        // buttons in DOM order: swap, set middle, inc
        const buttons = root.querySelectorAll('button');
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
        await userEvent.click(incBtn);
        expect(num.textContent).toBe('num: 1');
        await userEvent.click(incBtn);
        expect(num.textContent).toBe('num: 2');

        // set middle -> null becomes 'M' (renders between brackets)
        await userEvent.click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: [M]');
        // set middle again -> 'M' toggles back to null (empty)
        await userEvent.click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: []');

        // swap -> first/last swap; both adjacent (.full) and dash-separated (.dash) update
        await userEvent.click(swapBtn);
        expect(full.textContent).toBe('full: LovelaceAda');
        expect(dash.textContent).toBe('dash: Lovelace-Ada');
        // swap back -> returns to original ordering
        await userEvent.click(swapBtn);
        expect(full.textContent).toBe('full: AdaLovelace');
        expect(dash.textContent).toBe('dash: Ada-Lovelace');
    },
};
