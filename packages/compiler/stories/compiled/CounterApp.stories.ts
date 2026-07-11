import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/CounterApp';

export default { title: 'Compiled/CounterApp' };

export const Default = {
    render: () => '<counter-app></counter-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const button = find<HTMLButtonElement>('button', canvasElement);
        if (!button) throw new Error('counter-app did not render a button');

        // starts at zero
        expect(button.textContent).toBe('count is 0');

        // every click increments by one — assert each step of the reactive _text binding
        click(button);
        expect(button.textContent).toBe('count is 1');
        click(button);
        expect(button.textContent).toBe('count is 2');
        click(button);
        expect(button.textContent).toBe('count is 3');
        click(button);
        expect(button.textContent).toBe('count is 4');
    },
};
