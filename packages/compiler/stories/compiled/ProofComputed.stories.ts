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

        // Derived from state via a plain getter; `total` derives from `subtotal`
        // (a getter reading a getter) — no `computed()` anywhere.
        // qty 2 × price 10 = 20 → round(20 × 1.2) = 24
        expect(text('.subtotal')).toBe('20');
        expect(text('.total')).toBe('24');

        // Bumping qty must flow through both getters reactively.
        // qty 3 × 10 = 30 → round(36) = 36
        click(addQty);
        expect(text('.qty')).toBe('3');
        expect(text('.subtotal')).toBe('30');
        expect(text('.total')).toBe('36');

        // Bumping price too — the chained getter recomputes off the fresh state.
        // qty 3 × price 15 = 45 → round(54) = 54
        click(bumpPrice);
        expect(text('.price')).toBe('15');
        expect(text('.subtotal')).toBe('45');
        expect(text('.total')).toBe('54');
    },
};
