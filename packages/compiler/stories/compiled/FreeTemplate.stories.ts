import { expect } from '@neuralfog/elemix-testing-library';
import { type } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import { render as freeView } from './.emited/FreeTemplate';

export default { title: 'Compiled/FreeTemplate' };

export const Default = {
    render: () => freeView(),
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const input = find<HTMLInputElement>('input', canvasElement);
        const card = find('profile-card', canvasElement);
        if (!input || !card) {
            throw new Error('free template did not mount an input + profile-card');
        }

        const cardName = find('.info strong', card);
        const avatar = find('.avatar', card);
        const likes = find('.likes', card);
        if (!cardName || !avatar || !likes) {
            throw new Error('profile-card missing name, avatar, or likes');
        }

        expect(cardName.textContent).toBe('Ada Lovelace');
        expect(avatar.textContent).toBe('A');
        expect(likes.textContent).toBe('❤️ 0');

        type(input, '!');
        expect(input.value).toBe('Ada Lovelace!');
        expect(cardName.textContent).toBe('Ada Lovelace!');
        expect(avatar.textContent).toBe('A');
    },
};
