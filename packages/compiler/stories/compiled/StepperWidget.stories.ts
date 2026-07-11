import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StepperWidget';

export default { title: 'Compiled/StepperWidget' };

export const Default = {
    render: () => '<ui-stepper></ui-stepper>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // `#tag ui-stepper` overrode the derived `stepper-widget`, so the element
        // is registered (and queryable) under the explicit tag.
        const app = find('ui-stepper', canvasElement);
        const root = app?.shadowRoot;
        if (!root) throw new Error('ui-stepper did not render a shadow root');

        // `#styles ${css}` adopted a constructable stylesheet into the shadow root.
        expect(root.adoptedStyleSheets.length).toBeGreaterThan(0);

        const count = find('.count', canvasElement);
        const [dec, inc] = query('button', canvasElement);
        if (!count || !dec || !inc) {
            throw new Error('ui-stepper did not render its controls');
        }

        // reactive state + events flow through the pragma-registered component
        expect(count.textContent).toBe('0');
        click(inc);
        expect(count.textContent).toBe('1');
        click(inc);
        expect(count.textContent).toBe('2');
        click(dec);
        expect(count.textContent).toBe('1');
    },
};
