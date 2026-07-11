import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/SlotApp';

export default { title: 'Compiled/SlotApp' };

export const Default = {
    render: () => '<slot-app></slot-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const cards = query('app-card', canvasElement);
        if (cards.length !== 2) {
            throw new Error('slot-app did not render two app-card elements');
        }

        // the explanatory note is statically rendered with its inline <code>
        expect(find('.note', canvasElement)?.textContent).toContain("hasSlot('footer')");

        // --- first card: header + default + footer slotted content provided ---
        const first = cards[0];
        const firstHeader = find('.header', first);
        const firstBody = find('.body', first);
        const firstFooter = find('.footer', first);
        // hasSlot() renders all three regions
        expect(firstHeader).not.toBeNull();
        expect(firstBody).not.toBeNull();
        expect(firstFooter).not.toBeNull();

        // the named/default slots actually project the assigned light-DOM nodes
        const firstHeaderSlot = find('slot[name="header"]', first) as HTMLSlotElement;
        const firstFooterSlot = find('slot[name="footer"]', first) as HTMLSlotElement;
        const firstBodySlot = find('slot:not([name])', first) as HTMLSlotElement;
        expect(firstHeaderSlot.assignedNodes().map((n) => n.textContent).join('')).toContain('⭐ Featured');
        expect(firstFooterSlot.assignedNodes().map((n) => n.textContent).join('')).toContain('Updated just now');
        expect(firstBodySlot.assignedNodes().map((n) => n.textContent).join('')).toContain('Default-slot content lives in the card body.');

        // --- second card: only default body content, no header/footer slots ---
        const second = cards[1];
        // hasSlot('header')/hasSlot('footer') are false -> conditional regions omitted
        expect(find('.header', second)).toBeNull();
        expect(find('.footer', second)).toBeNull();
        const secondBody = find('.body', second);
        expect(secondBody).not.toBeNull();
        const secondBodySlot = find('slot:not([name])', second) as HTMLSlotElement;
        expect(secondBodySlot.assignedNodes().map((n) => n.textContent).join('')).toContain('This card has only body content');
    },
};
