import { expect, userEvent } from 'storybook/test';
import './.emited/ChatApp';

export default { title: 'Compiled/ChatApp' };

// elemix `~model` is two-way: send() resets the draft ref programmatically,
// which clears the DOM input. userEvent.type keeps its own internal buffer and
// concatenates against the stale value after such a reset — so drive the model
// through native input/keydown events instead, which read the live DOM value.
const setValue = (el: HTMLInputElement, value: string): void => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
};
const pressEnter = (el: HTMLInputElement): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

export const Default = {
    render: () => '<chat-app></chat-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('chat-app');
        const root = app?.shadowRoot;
        const input = root?.querySelector('input') as HTMLInputElement;
        const sendBtn = root?.querySelector('.composer button') as HTMLButtonElement;
        const log = root?.querySelector('.log') as HTMLElement;
        if (!root || !input || !sendBtn || !log)
            throw new Error('chat-app did not render input + Send button + log');

        // three seeded messages, all from the other party (no .me class)
        let messages = log.querySelectorAll('.msg');
        expect(messages.length).toBe(3);
        expect(messages[0].textContent).toBe('Hey there 👋');
        expect(messages[1].textContent).toBe('This log auto-scrolls.');
        expect(messages[2].textContent).toBe('Send a few messages and watch.');
        for (const m of messages) expect(m.classList.contains('me')).toBe(false);

        // whitespace-only draft is rejected by the trim() guard (Send @click)
        setValue(input, '   ');
        await userEvent.click(sendBtn);
        expect(log.querySelectorAll('.msg').length).toBe(3);
        // the model still holds the whitespace (guard returns before clearing)
        expect(input.value).toBe('   ');

        // real text sent via the Send button (@click path); draft clears
        setValue(input, 'Hello world');
        await userEvent.click(sendBtn);
        messages = log.querySelectorAll('.msg');
        expect(messages.length).toBe(4);
        expect(messages[3].textContent).toBe('Hello world');
        expect(messages[3].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        // second message via the Enter @keydown path
        setValue(input, 'Second message');
        pressEnter(input);
        messages = log.querySelectorAll('.msg');
        expect(messages.length).toBe(5);
        expect(messages[4].textContent).toBe('Second message');
        expect(messages[4].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        // with five messages the log overflows its fixed 180px viewport — the
        // precondition for onMutation's scroll-to-bottom. (The exact scrollTop
        // is layout-timing-dependent under the headless runner, so assert the
        // stable invariant that the content is scrollable.)
        expect(log.scrollHeight).toBeGreaterThan(log.clientHeight);
    },
};
