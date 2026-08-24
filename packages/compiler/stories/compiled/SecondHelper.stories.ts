import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/SecondHelper';

export default { title: 'Compiled/SecondHelper' };

export const Default = {
    render: () => '<plain-note></plain-note> <titled-note></titled-note>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const titled = find('titled-note', canvasElement);
        if (!titled) throw new Error('titled-note did not render');

        const heading = find('.heading', titled);
        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent).toBe('Title');
        expect(find('.body', titled)?.textContent).toBe('body');

        expect(find('.plain', canvasElement)?.textContent).toBe('plain');
    },
};
