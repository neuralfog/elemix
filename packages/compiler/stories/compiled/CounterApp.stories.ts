import { expect, userEvent } from 'storybook/test';
import './.emited/CounterApp';

export default { title: 'Compiled/CounterApp' };

export const Default = {
    render: () => '<counter-app></counter-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('counter-app');
        const button = app?.shadowRoot?.querySelector('button');
        if (!button) throw new Error('counter-app did not render a button');

        // starts at zero
        expect(button.textContent).toBe('count is 0');

        // every click increments by one — assert each step of the reactive _text binding
        await userEvent.click(button);
        expect(button.textContent).toBe('count is 1');
        await userEvent.click(button);
        expect(button.textContent).toBe('count is 2');
        await userEvent.click(button);
        expect(button.textContent).toBe('count is 3');
        await userEvent.click(button);
        expect(button.textContent).toBe('count is 4');
    },
};
