import { expect, userEvent } from 'storybook/test';
import '../.emited/CardListApp';

export default { title: 'Compiled/CardListApp' };

export const Default = {
    render: () => '<card-list-app></card-list-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('card-list-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('card-list-app did not render a shadow root');

        const cardName = (row: Element) =>
            row.querySelector('user-card')?.shadowRoot?.querySelector('.name')
                ?.textContent;
        const cardRole = (row: Element) =>
            row.querySelector('user-card')?.shadowRoot?.querySelector('.role')
                ?.textContent;

        // two seeded user-card rows: Ada/Engineer, Grace/Engineer.
        // assert BOTH :name and :role props flow into each child shadow root.
        let rows = root.querySelectorAll('.row');
        expect(rows.length).toBe(2);
        expect(root.querySelectorAll('user-card').length).toBe(2);
        expect(cardName(rows[0])).toBe('Ada');
        expect(cardRole(rows[0])).toBe('Engineer');
        expect(cardName(rows[1])).toBe('Grace');
        expect(cardRole(rows[1])).toBe('Engineer');

        // every row carries a promote and a drop button
        expect(rows[0].querySelector('button.promote')?.textContent).toBe('promote');
        expect(rows[0].querySelector('button.drop')?.textContent).toBe('×');

        // add a user: seq goes 2 -> 3, name = NAMES[3 % 6] = 'Margaret', role Engineer
        const addBtn = root.querySelector('.bar button') as HTMLButtonElement;
        expect(addBtn.textContent).toBe('Add user');
        await userEvent.click(addBtn);
        rows = root.querySelectorAll('.row');
        expect(rows.length).toBe(3);
        expect(root.querySelectorAll('user-card').length).toBe(3);
        expect(cardName(rows[2])).toBe('Margaret');
        expect(cardRole(rows[2])).toBe('Engineer');

        // add a second user: seq 3 -> 4, name = NAMES[4 % 6] = 'Dennis'
        await userEvent.click(addBtn);
        rows = root.querySelectorAll('.row');
        expect(rows.length).toBe(4);
        expect(cardName(rows[3])).toBe('Dennis');

        // promote the first row -> role becomes Lead via the :role prop binding,
        // and ONLY that row is affected (others stay Engineer).
        await userEvent.click(rows[0].querySelector('button.promote') as HTMLButtonElement);
        expect(cardRole(rows[0])).toBe('Lead');
        expect(cardRole(rows[1])).toBe('Engineer');
        expect(cardRole(rows[2])).toBe('Engineer');
        expect(cardRole(rows[3])).toBe('Engineer');

        // drop the second row (Grace) -> keyed repeat removes exactly that card,
        // leaving Ada(Lead), Margaret, Dennis in order.
        await userEvent.click(rows[1].querySelector('button.drop') as HTMLButtonElement);
        rows = root.querySelectorAll('.row');
        expect(rows.length).toBe(3);
        expect(cardName(rows[0])).toBe('Ada');
        expect(cardRole(rows[0])).toBe('Lead');
        expect(cardName(rows[1])).toBe('Margaret');
        expect(cardName(rows[2])).toBe('Dennis');

        // drop the now-first row (Ada) -> list shrinks again, Margaret leads
        await userEvent.click(rows[0].querySelector('button.drop') as HTMLButtonElement);
        rows = root.querySelectorAll('.row');
        expect(rows.length).toBe(2);
        expect(cardName(rows[0])).toBe('Margaret');
        expect(cardName(rows[1])).toBe('Dennis');
    },
};
