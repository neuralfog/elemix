import { expect } from '@neuralfog/elemix-testing-library';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import { click, type } from '@neuralfog/elemix-testing-library/events';
import './.emited/ProfileApp';

export default { title: 'Compiled/ProfileApp' };

export const Default = {
    render: () => '<profile-app></profile-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('profile-app', canvasElement);
        if (!app) throw new Error('profile-app did not render a shadow root');

        // inputs order: Name then Role; then the 👍 Like button
        const nameInput = query<HTMLInputElement>('input', app)[0];
        const roleInput = query<HTMLInputElement>('input', app)[1];
        const likeButton = find('button', app);
        const card = find('profile-card', app);
        if (!nameInput || !roleInput || !likeButton || !card) {
            throw new Error('profile-app missing name/role input, like button, or child card');
        }

        // child card mirrors the parent state via props
        const avatar = find('.avatar', card);
        const cardName = find('.info strong', card);
        const cardRole = find('.info span', card);
        const likes = find('.likes', card);
        if (!avatar || !cardName || !cardRole || !likes) {
            throw new Error('profile-card missing avatar, name, role, or likes');
        }

        // initial state: name "Ada Lovelace", role "Engineer", 0 likes.
        // avatar is name.charAt(0) -> "A".
        expect(nameInput.value).toBe('Ada Lovelace');
        expect(roleInput.value).toBe('Engineer');
        expect(avatar.textContent).toBe('A');
        expect(cardName.textContent).toBe('Ada Lovelace');
        expect(cardRole.textContent).toBe('Engineer');
        expect(likes.textContent).toBe('❤️ 0');

        // typing the name (~model) flows through the :name prop into the child card.
        // avatar (charAt(0)) is unchanged because we append.
        type(nameInput, '!');
        expect(nameInput.value).toBe('Ada Lovelace!');
        expect(cardName.textContent).toBe('Ada Lovelace!');
        expect(avatar.textContent).toBe('A');

        // typing the role (~model) flows through the :role prop into the child card
        type(roleInput, ' Lead');
        expect(roleInput.value).toBe('Engineer Lead');
        expect(cardRole.textContent).toBe('Engineer Lead');

        // liking increments the shared :likes count rendered by the child; do it twice
        click(likeButton);
        expect(likes.textContent).toBe('❤️ 1');
        click(likeButton);
        expect(likes.textContent).toBe('❤️ 2');
    },
};
