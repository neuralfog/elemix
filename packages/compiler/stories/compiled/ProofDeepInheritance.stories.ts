import { expect, userEvent } from 'storybook/test';
import './.emited/DeepInheritanceApp';

export default { title: 'Compiled/ProofDeepInheritance' };

export const Default = {
    render: () => '<deep-leaf></deep-leaf>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('deep-leaf');
        const root = app?.shadowRoot;
        if (!app || !root)
            throw new Error('deep-leaf did not render a shadow root');

        // template + state are INHERITED four levels up from DeepBase
        const button = root.querySelector('.btn');
        if (!button) throw new Error('inherited template did not render');
        expect(button.textContent?.trim()).toBe('count 0');

        // ALL four effects ran on mount → effects() chains super at every level
        // (no ancestor fx shadowed); each mirrors the inherited reactive count
        expect(app.getAttribute('data-base-fx')).toBe('0');
        expect(app.getAttribute('data-middle-fx')).toBe('0');
        expect(app.getAttribute('data-leg-fx')).toBe('0');
        expect(app.getAttribute('data-leaf-fx')).toBe('0');

        // inherited reactive state works on the deepest instance
        await userEvent.click(button);
        await userEvent.click(button);
        expect(button.textContent?.trim()).toBe('count 2');

        // all four effects re-ran reactively off the inherited state
        expect(app.getAttribute('data-base-fx')).toBe('2');
        expect(app.getAttribute('data-middle-fx')).toBe('2');
        expect(app.getAttribute('data-leg-fx')).toBe('2');
        expect(app.getAttribute('data-leaf-fx')).toBe('2');

        // ALL four lifecycle hooks ran → super chaining at every level
        expect(app.getAttribute('data-base')).toBe('on');
        expect(app.getAttribute('data-middle')).toBe('on');
        expect(app.getAttribute('data-leg')).toBe('on');
        expect(app.getAttribute('data-leaf')).toBe('on');

        // ALL four stylesheets adopted → sheets merged off the prototype at every
        // level, not replaced
        expect(root.adoptedStyleSheets.length).toBe(4);
        // and they actually RENDER on the same element: red background (base),
        // bold weight (middle), italic (leg), underline (leaf) — proof the merge
        // is real and cumulative, not just present
        const css = getComputedStyle(button as HTMLElement);
        expect(css.backgroundColor).toBe('rgb(220, 38, 38)'); // base sheet
        expect(css.fontWeight).toBe('700'); // middle sheet
        expect(css.fontStyle).toBe('italic'); // leg sheet
        expect(css.textDecorationLine).toBe('underline'); // leaf sheet
    },
};
