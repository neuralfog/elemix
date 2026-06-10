import { expect, userEvent } from 'storybook/test';
import './.emited/RefApp';

export default { title: 'Compiled/RefApp' };

export const Default = {
    render: () => '<ref-app></ref-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('ref-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('ref-app did not render a shadow root');

        const input = root.querySelector('input') as HTMLInputElement;
        const buttons = root.querySelectorAll('button');
        // button order: "Focus" then "Measure width" (.ghost)
        const focus = buttons[0];
        const measure = buttons[1];
        if (!input || !focus || !measure)
            throw new Error('ref-app missing input / Focus / Measure width button');

        expect(focus.textContent).toBe('Focus');
        expect(measure.textContent).toBe('Measure width');
        expect(measure.classList.contains('ghost')).toBe(true);
        expect(input.getAttribute('placeholder')).toBe('Type something…');

        // width starts at 0, so the conditional _child .out is not mounted
        expect(root.querySelector('.out')).toBeNull();

        // Focus button drives focus to the :ref-bound input
        await userEvent.click(focus);
        expect(root.activeElement).toBe(input);
        // focusing alone does not mount the readout
        expect(root.querySelector('.out')).toBeNull();

        // measuring reads the input's offsetWidth via the :ref, mounting the readout
        await userEvent.click(measure);
        const out = root.querySelector('.out');
        if (!out) throw new Error('ref-app did not mount .out after measuring');
        expect(out.textContent).toContain('Input is');
        expect(out.textContent).toContain('px wide');
        // the interpolated width is a positive integer pixel value
        const match = out.textContent?.match(/Input is (\d+)px wide/);
        if (!match) throw new Error('width readout did not match expected format');
        expect(Number(match[1])).toBe(input.offsetWidth);
        expect(input.offsetWidth).toBeGreaterThan(0);
    },
};
