import { expect } from 'storybook/test';
import './.emited/SecondHelper';

export default { title: 'Compiled/SecondHelper' };

export const Default = {
    render: () => '<plain-note></plain-note> <titled-note></titled-note>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const titled = canvasElement.querySelector('titled-note')?.shadowRoot;
        if (!titled) throw new Error('titled-note did not render');

        // The SECOND component's helper (`this.heading()`) must have been inlined
        // by splice — if it weren't, the heading would render as junk text (a
        // stringified DocumentFragment) instead of an actual <h2>.
        const heading = titled.querySelector('.heading');
        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent).toBe('Title');
        expect(titled.querySelector('.body')?.textContent).toBe('body');

        // sanity: the plain (first) component still renders
        const plain = canvasElement.querySelector('plain-note')?.shadowRoot;
        expect(plain?.querySelector('.plain')?.textContent).toBe('plain');
    },
};
