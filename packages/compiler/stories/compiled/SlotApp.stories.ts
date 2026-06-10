import { expect } from 'storybook/test';
import './.emited/SlotApp';

export default { title: 'Compiled/SlotApp' };

export const Default = {
    render: () => '<slot-app></slot-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('slot-app');
        const root = app?.shadowRoot;
        const cards = root?.querySelectorAll('app-card');
        if (!root || !cards || cards.length !== 2) {
            throw new Error('slot-app did not render two app-card elements');
        }

        // the explanatory note is statically rendered with its inline <code>
        expect(root.querySelector('.note')?.textContent).toContain("hasSlot('footer')");

        // --- first card: header + default + footer slotted content provided ---
        const first = cards[0].shadowRoot;
        const firstHeader = first?.querySelector('.header');
        const firstBody = first?.querySelector('.body');
        const firstFooter = first?.querySelector('.footer');
        // hasSlot() renders all three regions
        expect(firstHeader).not.toBeNull();
        expect(firstBody).not.toBeNull();
        expect(firstFooter).not.toBeNull();

        // the named/default slots actually project the assigned light-DOM nodes
        const firstHeaderSlot = firstHeader?.querySelector('slot[name="header"]') as HTMLSlotElement;
        const firstFooterSlot = firstFooter?.querySelector('slot[name="footer"]') as HTMLSlotElement;
        const firstBodySlot = firstBody?.querySelector('slot:not([name])') as HTMLSlotElement;
        expect(firstHeaderSlot.assignedNodes().map((n) => n.textContent).join('')).toContain('⭐ Featured');
        expect(firstFooterSlot.assignedNodes().map((n) => n.textContent).join('')).toContain('Updated just now');
        expect(firstBodySlot.assignedNodes().map((n) => n.textContent).join('')).toContain('Default-slot content lives in the card body.');

        // --- second card: only default body content, no header/footer slots ---
        const second = cards[1].shadowRoot;
        // hasSlot('header')/hasSlot('footer') are false -> conditional regions omitted
        expect(second?.querySelector('.header')).toBeNull();
        expect(second?.querySelector('.footer')).toBeNull();
        const secondBody = second?.querySelector('.body');
        expect(secondBody).not.toBeNull();
        const secondBodySlot = secondBody?.querySelector('slot:not([name])') as HTMLSlotElement;
        expect(secondBodySlot.assignedNodes().map((n) => n.textContent).join('')).toContain('This card has only body content');
    },
};
