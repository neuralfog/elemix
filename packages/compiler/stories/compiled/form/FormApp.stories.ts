import { expect } from '@neuralfog/elemix-testing-library';
import { click, type } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import '../.emited/FormApp';

export default { title: 'Compiled/FormApp' };

export const Default = {
    render: () => '<form-app></form-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('form-app', canvasElement);
        if (!app) throw new Error('form-app did not render a shadow root');

        const nameInput = find<HTMLInputElement>('input[name="name"]', app);
        const rating = find('rating-input', app);
        const submitButton = find('submit-button', app);
        const stars = query<HTMLElement>('button.star', rating ?? app);
        const submitBtn = submitButton
            ? find<HTMLButtonElement>('button', submitButton)
            : null;
        if (!nameInput || !stars || stars.length !== 5 || !submitBtn) {
            throw new Error('form-app did not render name input + five stars + submit button');
        }

        // the name field is seeded with its default value
        expect(nameInput.value).toBe('Ada');

        // result is empty initially -> conditional .out block is not mounted
        expect(find('.out', app)).toBeNull();

        // nothing selected initially — no star carries the active class
        expect(query('button.star.on', rating ?? app).length).toBe(0);

        // click the 3rd star (index 2) -> value becomes 3
        click(stars[2]);

        // _class reactivity marks the first three stars active (n <= value)
        let active = query('button.star.on', rating ?? app);
        expect(active.length).toBe(3);
        expect(stars[0].classList.contains('on')).toBe(true);
        expect(stars[1].classList.contains('on')).toBe(true);
        expect(stars[2].classList.contains('on')).toBe(true);
        expect(stars[3].classList.contains('on')).toBe(false);
        expect(stars[4].classList.contains('on')).toBe(false);

        // clicking a lower star reduces the value -> active count shrinks
        click(stars[1]);
        active = query('button.star.on', rating ?? app);
        expect(active.length).toBe(2);
        expect(stars[2].classList.contains('on')).toBe(false);

        // edit the name field (append-typing on the seeded value)
        type(nameInput, 'lovelace');
        expect(nameInput.value).toBe('Adalovelace');

        // clicking the submit-button custom element calls internals.form.requestSubmit(),
        // firing the form's @submit which serializes the participating custom elements
        click(submitBtn);

        // conditional .out is now mounted with the form-associated values
        const out = find('.out', app);
        if (!out) throw new Error('form-app did not mount .out after submit');
        const parsed = JSON.parse(out.textContent ?? '{}');
        expect(parsed.name).toBe('Adalovelace');
        // rating-input contributes its form value (2) via ElementInternals
        expect(parsed.rating).toBe('2');

        // re-rate and resubmit -> result updates reactively
        click(stars[4]);
        click(submitBtn);
        const parsed2 = JSON.parse(
            (find('.out', app)?.textContent ?? '{}'),
        );
        expect(parsed2.rating).toBe('5');
        expect(parsed2.name).toBe('Adalovelace');
    },
};
