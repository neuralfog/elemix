import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MethodHelperApp';

export default { title: 'Compiled/MethodHelperApp' };

export const Default = {
    render: () => '<method-helper-app></method-helper-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const chips = [...query('.row .chip', canvasElement)].map(
            (c) => c.textContent,
        );
        expect(chips).toEqual(['a', 'b']);

        expect(find('.open .chip', canvasElement)?.textContent).toBe('open');
        expect(find('.count', canvasElement)?.textContent).toBe('0');

        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.count', canvasElement)?.textContent).toBe('1');

        click(find('.toggle', canvasElement) as HTMLButtonElement);
        expect(find('.closed', canvasElement)?.textContent).toBe('closed');
        expect(find('.open', canvasElement)).toBe(null);
    },
};
