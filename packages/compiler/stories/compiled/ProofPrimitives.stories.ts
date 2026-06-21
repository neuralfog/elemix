import { expect, userEvent } from 'storybook/test';
import './.emited/PrimitiveStateApp';

export default { title: 'Compiled/ProofPrimitives' };

export const Default = {
    render: () => '<primitive-state-app></primitive-state-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('primitive-state-app');
        const root = app?.shadowRoot;
        if (!root)
            throw new Error('primitive-state-app did not render a shadow root');

        const count = root.querySelector('.count');
        const active = root.querySelector('.active');
        const label = root.querySelector('.label');
        if (!count || !active || !label)
            throw new Error('primitive-state-app missing count/active/label');

        // buttons in DOM order: +1, reset, toggle, rename
        const buttons = root.querySelectorAll('button');
        const incBtn = buttons[0];
        const resetBtn = buttons[1];
        const toggleBtn = buttons[2];
        const renameBtn = buttons[3];

        // initial bare-primitive state: number 0, boolean true, string 'idle'
        expect(count.textContent).toBe('0');
        expect(active.textContent).toBe('on');
        expect(label.textContent).toBe('idle');

        // number primitive reacts: this.count++ flows through the get/set accessor
        await userEvent.click(incBtn);
        await userEvent.click(incBtn);
        await userEvent.click(incBtn);
        expect(count.textContent).toBe('3');
        // independent slices untouched
        expect(active.textContent).toBe('on');
        expect(label.textContent).toBe('idle');

        // reset writes 0 — and the === guard means re-clicking reset is a no-op
        await userEvent.click(resetBtn);
        expect(count.textContent).toBe('0');
        await userEvent.click(resetBtn);
        expect(count.textContent).toBe('0');

        // boolean primitive reacts independently; counter untouched
        await userEvent.click(toggleBtn);
        expect(active.textContent).toBe('off');
        expect(count.textContent).toBe('0');
        await userEvent.click(toggleBtn);
        expect(active.textContent).toBe('on');

        // string primitive reacts independently; others untouched
        await userEvent.click(renameBtn);
        expect(label.textContent).toBe('busy');
        expect(active.textContent).toBe('on');
        await userEvent.click(renameBtn);
        expect(label.textContent).toBe('idle');

        // counter still live after the other slices moved
        await userEvent.click(incBtn);
        expect(count.textContent).toBe('1');
    },
};
