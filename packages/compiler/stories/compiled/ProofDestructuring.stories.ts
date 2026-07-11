import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/ProofDestructuring';

export default { title: 'Compiled/ProofDestructuring' };

export const Default = {
    render: () => '<proof-destructuring></proof-destructuring>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const count = () => find('.count', canvasElement)?.textContent;
        const inc = find<HTMLButtonElement>('.inc', canvasElement);
        const dec = find<HTMLButtonElement>('.dec', canvasElement);
        if (!inc || !dec) throw new Error('proof-destructuring did not render');

        // The handlers came from `const { inc, dec } = this` inside the template
        // body — if the compiler dropped that prelude, these clicks would throw
        // (inc/dec undefined). They don't, and the count (read reactively as
        // this.state.count) updates — so destructuring + hoisting both hold.
        expect(count()).toBe('0');
        click(inc);
        click(inc);
        expect(count()).toBe('2');
        click(dec);
        expect(count()).toBe('1');
    },
};
