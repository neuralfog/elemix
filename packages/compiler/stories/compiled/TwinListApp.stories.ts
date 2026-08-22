import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/TwinListApp';

export default { title: 'Compiled/TwinListApp' };

export const Default = {
    render: () => '<twin-list-app></twin-list-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const text = (sel: string): string[] =>
            query(sel, canvasElement).map((n) => n.textContent ?? '');

        expect(text('.left')).toEqual(['a', 'b', 'c']);
        expect(text('.right')).toEqual(['x', 'y']);

        const addLeft = find('.add-left', canvasElement) as HTMLButtonElement;
        const addRight = find('.add-right', canvasElement) as HTMLButtonElement;

        click(addLeft);
        expect(text('.left')).toEqual(['a', 'b', 'c', 'l3']);
        expect(text('.right')).toEqual(['x', 'y']);

        click(addRight);
        expect(text('.left')).toEqual(['a', 'b', 'c', 'l3']);
        expect(text('.right')).toEqual(['x', 'y', 'r2']);
    },
};
