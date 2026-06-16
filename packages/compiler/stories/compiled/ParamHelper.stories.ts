import { expect, userEvent } from 'storybook/test';
import './.emited/ParamHelper';

export default { title: 'Compiled/ParamHelper' };

export const Default = {
    render: () => '<row-list></row-list>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const root = canvasElement.querySelector('row-list')?.shadowRoot;
        if (!root) throw new Error('row-list did not render');

        const rows = () => [...root.querySelectorAll('.row')];

        // The parameterized helper `this.row(r)` was inlined with `item`→`r`, so
        // each row reads `r.id` / `r.name`. If it hadn't inlined, this.row would
        // be undefined and the list would never render.
        expect(rows().length).toBe(2);
        expect(rows()[0].textContent).toBe('alpha');
        expect(rows()[0].getAttribute('data-id')).toBe('1');
        expect(rows()[1].textContent).toBe('beta');
        expect(rows()[1].getAttribute('data-id')).toBe('2');

        // reactive through the keyed list: adding a row renders a new inlined row
        await userEvent.click(root.querySelector('.add') as HTMLButtonElement);
        expect(rows().length).toBe(3);
        expect(rows()[2].textContent).toBe('new');
        expect(rows()[2].getAttribute('data-id')).toBe('3');
    },
};
