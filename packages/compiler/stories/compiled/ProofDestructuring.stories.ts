import { expect, userEvent } from 'storybook/test';
import './.emited/ProofDestructuring';

export default { title: 'Compiled/ProofDestructuring' };

export const Default = {
    render: () => '<proof-destructuring></proof-destructuring>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const root = canvasElement.querySelector('proof-destructuring')?.shadowRoot;
        if (!root) throw new Error('proof-destructuring did not render');

        const count = () => root.querySelector('.count')?.textContent;
        const inc = root.querySelector('.inc') as HTMLButtonElement;
        const dec = root.querySelector('.dec') as HTMLButtonElement;

        // The handlers came from `const { inc, dec } = this` inside the template
        // body — if the compiler dropped that prelude, these clicks would throw
        // (inc/dec undefined). They don't, and the count (read reactively as
        // this.state.count) updates — so destructuring + hoisting both hold.
        expect(count()).toBe('0');
        await userEvent.click(inc);
        await userEvent.click(inc);
        expect(count()).toBe('2');
        await userEvent.click(dec);
        expect(count()).toBe('1');
    },
};
