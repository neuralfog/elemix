import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/InheritanceApp';

export default { title: 'Compiled/ProofInheritance' };

export const Default = {
    render: () => '<inherit-derived></inherit-derived>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('inherit-derived', canvasElement);
        const root = app?.shadowRoot;
        if (!app || !root)
            throw new Error('inherit-derived did not render a shadow root');

        const button = find('.btn', canvasElement);
        if (!button) throw new Error('inherited template did not render');
        expect(button.textContent?.trim()).toBe('count 0');

        expect(app.getAttribute('data-base-fx')).toBe('0');
        expect(app.getAttribute('data-derived-fx')).toBe('0');

        click(button);
        click(button);
        expect(button.textContent?.trim()).toBe('count 2');

        expect(app.getAttribute('data-base-fx')).toBe('2');
        expect(app.getAttribute('data-derived-fx')).toBe('2');

        expect(app.getAttribute('data-base')).toBe('on');
        expect(app.getAttribute('data-derived')).toBe('on');

        expect(root.adoptedStyleSheets.length).toBe(2);
        const css = getComputedStyle(button as HTMLElement);
        expect(css.backgroundColor).toBe('rgb(220, 38, 38)');
        expect(css.fontWeight).toBe('700');
    },
};
