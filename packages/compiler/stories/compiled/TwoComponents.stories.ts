import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/TwoComponents';

export default { title: 'Compiled/TwoComponents' };

export const Default = {
    render: () =>
        '<first-widget></first-widget> <second-widget></second-widget>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const firstHost = find('first-widget', canvasElement);
        const secondHost = find('second-widget', canvasElement);
        const first = find<HTMLButtonElement>('.first', firstHost ?? canvasElement);
        const second = find<HTMLButtonElement>('.second', secondHost ?? canvasElement);
        if (!first || !second) throw new Error('both widgets must render');

        expect(first.textContent).toBe('1');
        click(first);
        expect(first.textContent).toBe('2');

        expect(second.textContent).toBe('hi');
        click(second);
        expect(second.textContent).toBe('bye');

        expect(first.textContent).toBe('2');
    },
};
