import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/DerivedApp';

export default { title: 'Compiled/ProofComputed' };

export const Default = {
    render: () => '<derived-app></derived-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const text = (sel: string) => find(sel, canvasElement)?.textContent;
        const addQty = find('.add-qty', canvasElement) as HTMLButtonElement;
        const bumpPrice = find('.bump-price', canvasElement) as HTMLButtonElement;

        expect(text('.subtotal')).toBe('20');
        expect(text('.total')).toBe('24');

        click(addQty);
        expect(text('.qty')).toBe('3');
        expect(text('.subtotal')).toBe('30');
        expect(text('.total')).toBe('36');

        click(bumpPrice);
        expect(text('.price')).toBe('15');
        expect(text('.subtotal')).toBe('45');
        expect(text('.total')).toBe('54');
    },
};
