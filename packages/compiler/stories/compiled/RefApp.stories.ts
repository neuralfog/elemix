import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/RefApp';

export default { title: 'Compiled/RefApp' };

export const Default = {
    render: () => '<ref-app></ref-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('ref-app', canvasElement);
        const root = app?.shadowRoot;
        if (!root) throw new Error('ref-app did not render a shadow root');

        const input = find<HTMLInputElement>('input', canvasElement);
        const buttons = query('button', canvasElement);
        const focus = buttons[0];
        const measure = buttons[1];
        if (!input || !focus || !measure)
            throw new Error('ref-app missing input / Focus / Measure width button');

        expect(focus.textContent).toBe('Focus');
        expect(measure.textContent).toBe('Measure width');
        expect(measure.classList.contains('ghost')).toBe(true);
        expect(input.getAttribute('placeholder')).toBe('Type something…');

        expect(find('.out', canvasElement)).toBeNull();

        click(focus);
        expect(root.activeElement).toBe(input);
        expect(find('.out', canvasElement)).toBeNull();

        click(measure);
        const out = find('.out', canvasElement);
        if (!out) throw new Error('ref-app did not mount .out after measuring');
        expect(out.textContent).toContain('Input is');
        expect(out.textContent).toContain('px wide');
        const match = out.textContent?.match(/Input is (\d+)px wide/);
        if (!match) throw new Error('width readout did not match expected format');
        expect(Number(match[1])).toBe(input.offsetWidth);
        expect(input.offsetWidth).toBeGreaterThan(0);
    },
};
