import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import '../.emited/CardListApp';

export default { title: 'Compiled/CardListApp' };

export const Default = {
    render: () => '<card-list-app></card-list-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('card-list-app', canvasElement);
        if (!app) throw new Error('card-list-app did not render a shadow root');

        const cardName = (row: Element) => find('.name', row)?.textContent;
        const cardRole = (row: Element) => find('.role', row)?.textContent;

        // two seeded user-card rows: Ada/Engineer, Grace/Engineer.
        // assert BOTH :name and :role props flow into each child shadow root.
        let rows = query('.row', app);
        expect(rows.length).toBe(2);
        expect(query('user-card', app).length).toBe(2);
        expect(cardName(rows[0])).toBe('Ada');
        expect(cardRole(rows[0])).toBe('Engineer');
        expect(cardName(rows[1])).toBe('Grace');
        expect(cardRole(rows[1])).toBe('Engineer');

        // every row carries a promote and a drop button
        expect(find('button.promote', rows[0])?.textContent).toBe('promote');
        expect(find('button.drop', rows[0])?.textContent).toBe('×');

        // add a user: seq goes 2 -> 3, name = NAMES[3 % 6] = 'Margaret', role Engineer
        const addBtn = find<HTMLButtonElement>('.bar button', app) as HTMLButtonElement;
        expect(addBtn.textContent).toBe('Add user');
        click(addBtn);
        rows = query('.row', app);
        expect(rows.length).toBe(3);
        expect(query('user-card', app).length).toBe(3);
        expect(cardName(rows[2])).toBe('Margaret');
        expect(cardRole(rows[2])).toBe('Engineer');

        // add a second user: seq 3 -> 4, name = NAMES[4 % 6] = 'Dennis'
        click(addBtn);
        rows = query('.row', app);
        expect(rows.length).toBe(4);
        expect(cardName(rows[3])).toBe('Dennis');

        // promote the first row -> role becomes Lead via the :role prop binding,
        // and ONLY that row is affected (others stay Engineer).
        click(find<HTMLButtonElement>('button.promote', rows[0]) as HTMLButtonElement);
        expect(cardRole(rows[0])).toBe('Lead');
        expect(cardRole(rows[1])).toBe('Engineer');
        expect(cardRole(rows[2])).toBe('Engineer');
        expect(cardRole(rows[3])).toBe('Engineer');

        // drop the second row (Grace) -> keyed repeat removes exactly that card,
        // leaving Ada(Lead), Margaret, Dennis in order.
        click(find<HTMLButtonElement>('button.drop', rows[1]) as HTMLButtonElement);
        rows = query('.row', app);
        expect(rows.length).toBe(3);
        expect(cardName(rows[0])).toBe('Ada');
        expect(cardRole(rows[0])).toBe('Lead');
        expect(cardName(rows[1])).toBe('Margaret');
        expect(cardName(rows[2])).toBe('Dennis');

        // drop the now-first row (Ada) -> list shrinks again, Margaret leads
        click(find<HTMLButtonElement>('button.drop', rows[0]) as HTMLButtonElement);
        rows = query('.row', app);
        expect(rows.length).toBe(2);
        expect(cardName(rows[0])).toBe('Margaret');
        expect(cardName(rows[1])).toBe('Dennis');
    },
};
