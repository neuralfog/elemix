import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/PrimitiveStateApp';

export default { title: 'Compiled/ProofPrimitives' };

export const Default = {
    render: () => '<primitive-state-app></primitive-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const count = find('.count', canvasElement);
        const active = find('.active', canvasElement);
        const label = find('.label', canvasElement);
        if (!count || !active || !label)
            throw new Error('primitive-state-app missing count/active/label');

        const buttons = query('button', canvasElement);
        const incBtn = buttons[0];
        const resetBtn = buttons[1];
        const toggleBtn = buttons[2];
        const renameBtn = buttons[3];

        expect(count.textContent).toBe('0');
        expect(active.textContent).toBe('on');
        expect(label.textContent).toBe('idle');

        click(incBtn);
        click(incBtn);
        click(incBtn);
        expect(count.textContent).toBe('3');
        expect(active.textContent).toBe('on');
        expect(label.textContent).toBe('idle');

        click(resetBtn);
        expect(count.textContent).toBe('0');
        click(resetBtn);
        expect(count.textContent).toBe('0');

        click(toggleBtn);
        expect(active.textContent).toBe('off');
        expect(count.textContent).toBe('0');
        click(toggleBtn);
        expect(active.textContent).toBe('on');

        click(renameBtn);
        expect(label.textContent).toBe('busy');
        expect(active.textContent).toBe('on');
        click(renameBtn);
        expect(label.textContent).toBe('idle');

        click(incBtn);
        expect(count.textContent).toBe('1');
    },
};
