import { expect, userEvent } from 'storybook/test';
import '../.emited/FormApp';

export default { title: 'Compiled/FormApp' };

export const Default = {
    render: () => '<form-app></form-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('form-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('form-app did not render a shadow root');

        const nameInput = root.querySelector('input[name="name"]') as HTMLInputElement;
        const rating = root.querySelector('rating-input');
        const submitButton = root.querySelector('submit-button');
        const stars = rating?.shadowRoot?.querySelectorAll('button.star');
        const submitBtn = submitButton?.shadowRoot?.querySelector('button') as HTMLButtonElement;
        if (!nameInput || !stars || stars.length !== 5 || !submitBtn) {
            throw new Error('form-app did not render name input + five stars + submit button');
        }

        // the name field is seeded with its default value
        expect(nameInput.value).toBe('Ada');

        // result is empty initially -> conditional .out block is not mounted
        expect(root.querySelector('.out')).toBeNull();

        // nothing selected initially — no star carries the active class
        expect(rating?.shadowRoot?.querySelectorAll('button.star.on').length).toBe(0);

        // click the 3rd star (index 2) -> value becomes 3
        await userEvent.click(stars[2] as HTMLElement);

        // _class reactivity marks the first three stars active (n <= value)
        let active = rating?.shadowRoot?.querySelectorAll('button.star.on');
        expect(active?.length).toBe(3);
        expect((stars[0] as HTMLElement).classList.contains('on')).toBe(true);
        expect((stars[1] as HTMLElement).classList.contains('on')).toBe(true);
        expect((stars[2] as HTMLElement).classList.contains('on')).toBe(true);
        expect((stars[3] as HTMLElement).classList.contains('on')).toBe(false);
        expect((stars[4] as HTMLElement).classList.contains('on')).toBe(false);

        // clicking a lower star reduces the value -> active count shrinks
        await userEvent.click(stars[1] as HTMLElement);
        active = rating?.shadowRoot?.querySelectorAll('button.star.on');
        expect(active?.length).toBe(2);
        expect((stars[2] as HTMLElement).classList.contains('on')).toBe(false);

        // edit the name field (append-typing on the seeded value)
        await userEvent.type(nameInput, 'lovelace');
        expect(nameInput.value).toBe('Adalovelace');

        // clicking the submit-button custom element calls internals.form.requestSubmit(),
        // firing the form's @submit which serializes the participating custom elements
        await userEvent.click(submitBtn);

        // conditional .out is now mounted with the form-associated values
        const out = root.querySelector('.out');
        if (!out) throw new Error('form-app did not mount .out after submit');
        const parsed = JSON.parse(out.textContent ?? '{}');
        expect(parsed.name).toBe('Adalovelace');
        // rating-input contributes its form value (2) via ElementInternals
        expect(parsed.rating).toBe('2');

        // re-rate and resubmit -> result updates reactively
        await userEvent.click(stars[4] as HTMLElement);
        await userEvent.click(submitBtn);
        const parsed2 = JSON.parse(
            (root.querySelector('.out')?.textContent ?? '{}'),
        );
        expect(parsed2.rating).toBe('5');
        expect(parsed2.name).toBe('Adalovelace');
    },
};
