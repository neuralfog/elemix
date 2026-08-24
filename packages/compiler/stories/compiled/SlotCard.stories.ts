import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/SlotCard';

export default { title: 'Compiled/SlotCard' };

export const Default = {
    render: () => '<slot-card></slot-card>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const items = query('slot-item', canvasElement);
        if (items.length !== 2) {
            throw new Error('slot-card did not render two slot-item elements');
        }
        const panels = query('slot-panel', canvasElement);
        if (panels.length !== 2) {
            throw new Error('expected two slot-panel elements');
        }
        const chips = query('slot-chip', canvasElement);
        if (chips.length !== 6) {
            throw new Error('expected six slot-chip elements');
        }

        expect(find('.item h3', items[0])?.textContent).toContain('Group One');
        expect(find('.item h3', items[1])?.textContent).toContain('Group Two');

        const labels = chips.map((c) => find('.chip', c)?.textContent ?? '');
        expect(labels).toEqual([
            'Alpha',
            'Beta',
            'Gamma',
            'Delta',
            'Epsilon',
            'Zeta',
        ]);
    },
};
