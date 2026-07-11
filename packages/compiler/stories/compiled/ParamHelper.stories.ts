import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/ParamHelper';

export default { title: 'Compiled/ParamHelper' };

export const Default = {
    render: () => '<row-list></row-list>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const rows = () => query('.row', canvasElement);

        // The parameterized helper `this.row(r)` was inlined with `item`→`r`, so
        // each row reads `r.id` / `r.name`. If it hadn't inlined, this.row would
        // be undefined and the list would never render.
        expect(rows().length).toBe(2);
        expect(rows()[0].textContent).toBe('alpha');
        expect(rows()[0].getAttribute('data-id')).toBe('1');
        expect(rows()[1].textContent).toBe('beta');
        expect(rows()[1].getAttribute('data-id')).toBe('2');

        // reactive through the keyed list: adding a row renders a new inlined row
        click(find('.add', canvasElement) as HTMLButtonElement);
        expect(rows().length).toBe(3);
        expect(rows()[2].textContent).toBe('new');
        expect(rows()[2].getAttribute('data-id')).toBe('3');
    },
};
