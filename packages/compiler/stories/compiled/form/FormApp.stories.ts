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

        expect(nameInput.value).toBe('Ada');

        expect(find('.out', app)).toBeNull();

        expect(query('button.star.on', rating ?? app).length).toBe(0);

        click(stars[2]);

        let active = query('button.star.on', rating ?? app);
        expect(active.length).toBe(3);
        expect(stars[0].classList.contains('on')).toBe(true);
        expect(stars[1].classList.contains('on')).toBe(true);
        expect(stars[2].classList.contains('on')).toBe(true);
        expect(stars[3].classList.contains('on')).toBe(false);
        expect(stars[4].classList.contains('on')).toBe(false);

        click(stars[1]);
        active = query('button.star.on', rating ?? app);
        expect(active.length).toBe(2);
        expect(stars[2].classList.contains('on')).toBe(false);

        type(nameInput, 'lovelace');
        expect(nameInput.value).toBe('Adalovelace');

        click(submitBtn);

        const out = find('.out', app);
        if (!out) throw new Error('form-app did not mount .out after submit');
        const parsed = JSON.parse(out.textContent ?? '{}');
        expect(parsed.name).toBe('Adalovelace');
        expect(parsed.rating).toBe('2');

        click(stars[4]);
        click(submitBtn);
        const parsed2 = JSON.parse(
            (find('.out', app)?.textContent ?? '{}'),
        );
        expect(parsed2.rating).toBe('5');
        expect(parsed2.name).toBe('Adalovelace');
    },
};
