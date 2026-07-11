import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/SecondHelper';

export default { title: 'Compiled/SecondHelper' };

export const Default = {
    render: () => '<plain-note></plain-note> <titled-note></titled-note>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const titled = find('titled-note', canvasElement);
        if (!titled) throw new Error('titled-note did not render');

        // The SECOND component's helper (`this.heading()`) must have been inlined
        // by splice — if it weren't, the heading would render as junk text (a
        // stringified DocumentFragment) instead of an actual <h2>.
        const heading = find('.heading', titled);
        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent).toBe('Title');
        expect(find('.body', titled)?.textContent).toBe('body');

        // sanity: the plain (first) component still renders
        expect(find('.plain', canvasElement)?.textContent).toBe('plain');
    },
};
