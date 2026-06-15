import { expect, userEvent } from 'storybook/test';
import './.emited/StepperWidget';

export default { title: 'Compiled/StepperWidget' };

export const Default = {
    render: () => '<ui-stepper></ui-stepper>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // `#tag ui-stepper` overrode the derived `stepper-widget`, so the element
        // is registered (and queryable) under the explicit tag.
        const app = canvasElement.querySelector('ui-stepper');
        const root = app?.shadowRoot;
        if (!root) throw new Error('ui-stepper did not render a shadow root');

        // `#styles ${css}` adopted a constructable stylesheet into the shadow root.
        expect(root.adoptedStyleSheets.length).toBeGreaterThan(0);

        const count = root.querySelector('.count');
        const [dec, inc] = root.querySelectorAll('button');
        if (!count || !dec || !inc) {
            throw new Error('ui-stepper did not render its controls');
        }

        // reactive state + events flow through the pragma-registered component
        expect(count.textContent).toBe('0');
        await userEvent.click(inc);
        expect(count.textContent).toBe('1');
        await userEvent.click(inc);
        expect(count.textContent).toBe('2');
        await userEvent.click(dec);
        expect(count.textContent).toBe('1');
    },
};
