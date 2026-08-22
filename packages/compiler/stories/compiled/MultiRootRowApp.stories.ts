import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/MultiRootRowApp';

export default { title: 'Compiled/MultiRootRowApp' };

export const Default = {
    render: () => '<multi-root-row-app></multi-root-row-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const text = (sel: string): string[] =>
            query(sel, canvasElement).map((n) => n.textContent ?? '');

        expect(text('.inner')).toEqual(['a', 'b', 'c']);
        expect(text('.tail')).toEqual(['end-g1', 'end-g2']);

        click(find('.add', canvasElement) as HTMLButtonElement);
        expect(text('.inner')).toEqual(['a', 'b', 'c', 'z']);
        expect(text('.tail')).toEqual(['end-g1', 'end-g2', 'end-g3']);
    },
};
