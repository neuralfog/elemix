import { expect, userEvent } from 'storybook/test';
import './.emited/ProfileApp';

export default { title: 'Compiled/ProfileApp' };

export const Default = {
    render: () => '<profile-app></profile-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('profile-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('profile-app did not render a shadow root');

        // inputs order: Name then Role; then the 👍 Like button
        const nameInput = root.querySelectorAll('input')[0];
        const roleInput = root.querySelectorAll('input')[1];
        const likeButton = root.querySelector('button');
        const card = root.querySelector('profile-card');
        const cardRoot = card?.shadowRoot;
        if (!nameInput || !roleInput || !likeButton || !cardRoot) {
            throw new Error('profile-app missing name/role input, like button, or child card');
        }

        // child card mirrors the parent state via props
        const avatar = cardRoot.querySelector('.avatar');
        const cardName = cardRoot.querySelector('.info strong');
        const cardRole = cardRoot.querySelector('.info span');
        const likes = cardRoot.querySelector('.likes');
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
        await userEvent.type(nameInput, '!');
        expect(nameInput.value).toBe('Ada Lovelace!');
        expect(cardName.textContent).toBe('Ada Lovelace!');
        expect(avatar.textContent).toBe('A');

        // typing the role (~model) flows through the :role prop into the child card
        await userEvent.type(roleInput, ' Lead');
        expect(roleInput.value).toBe('Engineer Lead');
        expect(cardRole.textContent).toBe('Engineer Lead');

        // liking increments the shared :likes count rendered by the child; do it twice
        await userEvent.click(likeButton);
        expect(likes.textContent).toBe('❤️ 1');
        await userEvent.click(likeButton);
        expect(likes.textContent).toBe('❤️ 2');
    },
};
