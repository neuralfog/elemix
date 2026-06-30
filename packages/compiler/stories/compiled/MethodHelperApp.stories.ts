import { expect, userEvent } from 'storybook/test';
import './.emited/MethodHelperApp';

export default { title: 'Compiled/MethodHelperApp' };

export const Default = {
    render: () => '<method-helper-app></method-helper-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('method-helper-app');
        if (!app) throw new Error('method-helper-app did not render');
        const root = app.shadowRoot;
        if (!root) throw new Error('method-helper-app has no shadow root');

        // helper called at the top level of a METHOD-form template — inlined
        const chips = [...root.querySelectorAll('.row .chip')].map(
            (c) => c.textContent,
        );
        expect(chips).toEqual(['a', 'b']);

        // helper called INSIDE the nested ternary branch — also inlined
        expect(root.querySelector('.open .chip')?.textContent).toBe('open');
        expect(root.querySelector('.count')?.textContent).toBe('0');

        // reactivity intact through the method-form template
        await userEvent.click(root.querySelector('.inc') as HTMLButtonElement);
        expect(root.querySelector('.count')?.textContent).toBe('1');

        // the conditional branch swaps; the nested helper unmounts with it
        await userEvent.click(root.querySelector('.toggle') as HTMLButtonElement);
        expect(root.querySelector('.closed')?.textContent).toBe('closed');
        expect(root.querySelector('.open')).toBe(null);
    },
};
