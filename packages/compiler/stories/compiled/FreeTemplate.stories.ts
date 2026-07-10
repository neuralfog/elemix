import { expect, userEvent } from 'storybook/test';
import { render as freeView } from './.emited/FreeTemplate';

// A free-standing `tpl` (a plain module export, NOT a component's `template`
// member) is lowered to an inline builder that returns a live DocumentFragment.
// Mounting it wires `:props`/`@event`/`~model` on the child component with no
// wrapper component in sight.
export default { title: 'Compiled/FreeTemplate' };

export const Default = {
    render: () => freeView(),
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const input = canvasElement.querySelector('input');
        const card = canvasElement.querySelector('profile-card');
        const cardRoot = card?.shadowRoot;
        if (!input || !cardRoot) {
            throw new Error('free template did not mount an input + profile-card');
        }

        // the child card upgraded and read its `:name`/`:likes` props — no wrapper.
        const cardName = cardRoot.querySelector('.info strong');
        const avatar = cardRoot.querySelector('.avatar');
        const likes = cardRoot.querySelector('.likes');
        if (!cardName || !avatar || !likes) {
            throw new Error('profile-card missing name, avatar, or likes');
        }

        expect(cardName.textContent).toBe('Ada Lovelace');
        expect(avatar.textContent).toBe('A');
        expect(likes.textContent).toBe('❤️ 0');

        // typing the `~model` input flows through the `:name` prop into the child.
        await userEvent.type(input, '!');
        expect(input.value).toBe('Ada Lovelace!');
        expect(cardName.textContent).toBe('Ada Lovelace!');
        expect(avatar.textContent).toBe('A');
    },
};
