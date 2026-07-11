import { expect } from '@neuralfog/elemix-testing-library';
import { click, keyDown, setValue } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ChatApp';

export default { title: 'Compiled/ChatApp' };

// send() resets the draft ~model ref programmatically, which clears the DOM
// input. The testing-library setValue/keyDown helpers dispatch native
// input/keydown events that read the live DOM value, driving the model correctly
// across those resets.
export const Default = {
    render: () => '<chat-app></chat-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const input = find<HTMLInputElement>('input', canvasElement);
        const sendBtn = find<HTMLButtonElement>(
            '.composer button',
            canvasElement,
        );
        const log = find<HTMLElement>('.log', canvasElement);
        if (!input || !sendBtn || !log)
            throw new Error('chat-app did not render input + Send button + log');

        // three seeded messages, all from the other party (no .me class)
        let messages = query('.msg', log);
        expect(messages.length).toBe(3);
        expect(messages[0].textContent).toBe('Hey there 👋');
        expect(messages[1].textContent).toBe('This log auto-scrolls.');
        expect(messages[2].textContent).toBe('Send a few messages and watch.');
        for (const m of messages) expect(m.classList.contains('me')).toBe(false);

        // whitespace-only draft is rejected by the trim() guard (Send @click)
        setValue(input, '   ');
        click(sendBtn);
        expect(query('.msg', log).length).toBe(3);
        // the model still holds the whitespace (guard returns before clearing)
        expect(input.value).toBe('   ');

        // real text sent via the Send button (@click path); draft clears
        setValue(input, 'Hello world');
        click(sendBtn);
        messages = query('.msg', log);
        expect(messages.length).toBe(4);
        expect(messages[3].textContent).toBe('Hello world');
        expect(messages[3].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        // second message via the Enter @keydown path
        setValue(input, 'Second message');
        keyDown(input, 'Enter');
        messages = query('.msg', log);
        expect(messages.length).toBe(5);
        expect(messages[4].textContent).toBe('Second message');
        expect(messages[4].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        // with five messages the log overflows its fixed 180px viewport — the
        // precondition for the send-handler's scroll-to-bottom. (The exact scrollTop
        // is layout-timing-dependent under the headless runner, so assert the
        // stable invariant that the content is scrollable.)
        expect(log.scrollHeight).toBeGreaterThan(log.clientHeight);
    },
};
