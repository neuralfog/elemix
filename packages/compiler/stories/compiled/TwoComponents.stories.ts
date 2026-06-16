import { expect, userEvent } from 'storybook/test';
import './.emited/TwoComponents';

export default { title: 'Compiled/TwoComponents' };

export const Default = {
    render: () =>
        '<first-widget></first-widget> <second-widget></second-widget>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const first = canvasElement
            .querySelector('first-widget')
            ?.shadowRoot?.querySelector('.first') as HTMLButtonElement | undefined;
        const second = canvasElement
            .querySelector('second-widget')
            ?.shadowRoot?.querySelector('.second') as HTMLButtonElement | undefined;
        if (!first || !second) throw new Error('both widgets must render');

        // Two components defined in ONE file — each compiled to its own view(),
        // registered under its own tag, reacting independently.
        expect(first.textContent).toBe('1');
        await userEvent.click(first);
        expect(first.textContent).toBe('2');

        expect(second.textContent).toBe('hi');
        await userEvent.click(second);
        expect(second.textContent).toBe('bye');

        // and the first is untouched by the second's update
        expect(first.textContent).toBe('2');
    },
};
