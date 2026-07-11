import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MethodHelperApp';

export default { title: 'Compiled/MethodHelperApp' };

export const Default = {
    render: () => '<method-helper-app></method-helper-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        // helper called at the top level of a METHOD-form template — inlined
        const chips = [...query('.row .chip', canvasElement)].map(
            (c) => c.textContent,
        );
        expect(chips).toEqual(['a', 'b']);

        // helper called INSIDE the nested ternary branch — also inlined
        expect(find('.open .chip', canvasElement)?.textContent).toBe('open');
        expect(find('.count', canvasElement)?.textContent).toBe('0');

        // reactivity intact through the method-form template
        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.count', canvasElement)?.textContent).toBe('1');

        // the conditional branch swaps; the nested helper unmounts with it
        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.closed', canvasElement)?.textContent).toBe('closed');
        expect(find('.open', canvasElement)).toBe(null);
    },
};
