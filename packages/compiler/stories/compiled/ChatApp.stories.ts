import { expect } from '@neuralfog/elemix-testing-library';
import { click, keyDown, setValue } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/ChatApp';

export default { title: 'Compiled/ChatApp' };

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

        let messages = query('.msg', log);
        expect(messages.length).toBe(3);
        expect(messages[0].textContent).toBe('Hey there 👋');
        expect(messages[1].textContent).toBe('This log auto-scrolls.');
        expect(messages[2].textContent).toBe('Send a few messages and watch.');
        for (const m of messages) expect(m.classList.contains('me')).toBe(false);

        setValue(input, '   ');
        click(sendBtn);
        expect(query('.msg', log).length).toBe(3);
        expect(input.value).toBe('   ');

        setValue(input, 'Hello world');
        click(sendBtn);
        messages = query('.msg', log);
        expect(messages.length).toBe(4);
        expect(messages[3].textContent).toBe('Hello world');
        expect(messages[3].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        setValue(input, 'Second message');
        keyDown(input, 'Enter');
        messages = query('.msg', log);
        expect(messages.length).toBe(5);
        expect(messages[4].textContent).toBe('Second message');
        expect(messages[4].classList.contains('me')).toBe(true);
        expect(input.value).toBe('');

        expect(log.scrollHeight).toBeGreaterThan(log.clientHeight);
    },
};
