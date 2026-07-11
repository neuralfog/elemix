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

        // template + state are INHERITED from the base via the prototype
        const button = find('.btn', canvasElement);
        if (!button) throw new Error('inherited template did not render');
        expect(button.textContent?.trim()).toBe('count 0');

        // BOTH effects ran on mount → effects() chains super (base fx not
        // shadowed); each mirrors the inherited reactive count
        expect(app.getAttribute('data-base-fx')).toBe('0');
        expect(app.getAttribute('data-derived-fx')).toBe('0');

        // inherited reactive state works on the derived instance
        click(button);
        click(button);
        expect(button.textContent?.trim()).toBe('count 2');

        // both effects re-ran reactively off the inherited state
        expect(app.getAttribute('data-base-fx')).toBe('2');
        expect(app.getAttribute('data-derived-fx')).toBe('2');

        // BOTH lifecycle hooks ran → super chaining (base hook not shadowed)
        expect(app.getAttribute('data-base')).toBe('on');
        expect(app.getAttribute('data-derived')).toBe('on');

        // BOTH stylesheets adopted → sheets merged off the prototype, not replaced
        expect(root.adoptedStyleSheets.length).toBe(2);
        // and they actually RENDER on the same element: the red background comes
        // from the base sheet, the bold weight from the derived one — proof the
        // merge is real, not just present
        const css = getComputedStyle(button as HTMLElement);
        expect(css.backgroundColor).toBe('rgb(220, 38, 38)'); // base sheet
        expect(css.fontWeight).toBe('700'); // derived sheet
    },
};
