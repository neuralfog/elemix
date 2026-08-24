import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StepperWidget';

export default { title: 'Compiled/StepperWidget' };

export const Default = {
    render: () => '<ui-stepper></ui-stepper>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('ui-stepper', canvasElement);
        const root = app?.shadowRoot;
        if (!root) throw new Error('ui-stepper did not render a shadow root');

        expect(root.adoptedStyleSheets.length).toBeGreaterThan(0);

        const count = find('.count', canvasElement);
        const [dec, inc] = query('button', canvasElement);
        if (!count || !dec || !inc) {
            throw new Error('ui-stepper did not render its controls');
        }

        expect(count.textContent).toBe('0');
        click(inc);
        expect(count.textContent).toBe('1');
        click(inc);
        expect(count.textContent).toBe('2');
        click(dec);
        expect(count.textContent).toBe('1');
    },
};
