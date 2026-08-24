import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/DeepInheritanceApp';

export default { title: 'Compiled/ProofDeepInheritance' };

export const Default = {
    render: () => '<deep-leaf></deep-leaf>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('deep-leaf', canvasElement);
        const root = app?.shadowRoot;
        if (!app || !root)
            throw new Error('deep-leaf did not render a shadow root');

        const button = find('.btn', canvasElement);
        if (!button) throw new Error('inherited template did not render');
        expect(button.textContent?.trim()).toBe('count 0');

        expect(app.getAttribute('data-base-fx')).toBe('0');
        expect(app.getAttribute('data-middle-fx')).toBe('0');
        expect(app.getAttribute('data-leg-fx')).toBe('0');
        expect(app.getAttribute('data-leaf-fx')).toBe('0');

        click(button);
        click(button);
        expect(button.textContent?.trim()).toBe('count 2');

        expect(app.getAttribute('data-base-fx')).toBe('2');
        expect(app.getAttribute('data-middle-fx')).toBe('2');
        expect(app.getAttribute('data-leg-fx')).toBe('2');
        expect(app.getAttribute('data-leaf-fx')).toBe('2');

        expect(app.getAttribute('data-base')).toBe('on');
        expect(app.getAttribute('data-middle')).toBe('on');
        expect(app.getAttribute('data-leg')).toBe('on');
        expect(app.getAttribute('data-leaf')).toBe('on');

        expect(root.adoptedStyleSheets.length).toBe(4);
        const css = getComputedStyle(button as HTMLElement);
        expect(css.backgroundColor).toBe('rgb(220, 38, 38)');
        expect(css.fontWeight).toBe('700');
        expect(css.fontStyle).toBe('italic');
        expect(css.textDecorationLine).toBe('underline');
    },
};
