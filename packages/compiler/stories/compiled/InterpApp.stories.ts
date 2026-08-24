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

        const buttons = query('button', canvasElement);
        const swapBtn = buttons[0];
        const setMiddleBtn = buttons[1];
        const incBtn = buttons[2];

        expect(full.textContent).toBe('full: AdaLovelace');
        expect(dash.textContent).toBe('dash: Ada-Lovelace');
        expect(middle.textContent).toBe('middle: []');
        expect(num.textContent).toBe('num: 0');

        click(incBtn);
        expect(num.textContent).toBe('num: 1');
        click(incBtn);
        expect(num.textContent).toBe('num: 2');

        click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: [M]');
        click(setMiddleBtn);
        expect(middle.textContent).toBe('middle: []');

        click(swapBtn);
        expect(full.textContent).toBe('full: LovelaceAda');
        expect(dash.textContent).toBe('dash: Lovelace-Ada');
        click(swapBtn);
        expect(full.textContent).toBe('full: AdaLovelace');
        expect(dash.textContent).toBe('dash: Ada-Lovelace');
    },
};
