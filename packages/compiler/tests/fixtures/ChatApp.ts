import { Component, defineComponent, ref, state, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Ref, Template } from '@neuralfog/elemix/types';

type Message = { id: string; text: string; me: boolean };

type State = {
    draft: Ref<string>;
    messages: Message[];
};

const css = `
    :host {
        --accent: #6366f1;
        display: block;
        max-width: 400px;
        font-family: system-ui, sans-serif;
        color: #1e293b;
    }
    .note {
        margin: 0 0 16px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
        background: #f1f5f9;
        border-left: 3px solid var(--accent);
        border-radius: 8px;
    }
    code {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        background: #e2e8f0;
        padding: 1px 5px;
        border-radius: 4px;
    }
    .log {
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 180px;
        overflow-y: auto;
        padding: 12px;
        margin-bottom: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    .msg {
        align-self: flex-start;
        max-width: 80%;
        padding: 8px 12px;
        font-size: 14px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }
    .msg.me {
        align-self: flex-end;
        background: var(--accent);
        color: white;
        border-color: transparent;
    }
    .composer { display: flex; gap: 8px; }
    input {
        flex: 1;
        font: inherit;
        padding: 9px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        outline: none;
    }
    input:focus { border-color: var(--accent); }
    button {
        font: inherit;
        padding: 9px 16px;
        border: none;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
`;

export class ChatApp extends Component {
    static styles = [css];

    state = state<State>({
        draft: ref(''),
        messages: [
            { id: 'a', text: 'Hey there 👋', me: false },
            { id: 'b', text: 'This log auto-scrolls.', me: false },
            { id: 'c', text: 'Send a few messages and watch.', me: false },
        ],
    });

    private seq = 0;
    private nextId = (): string => `m${++this.seq}`;

    send = (): void => {
        const text = this.state.draft.value.trim();
        if (!text) return;
        this.state.messages.push({ id: this.nextId(), text, me: true });
        this.state.draft.value = '';
    };

    onMutation(): void {
        const log = this.root?.querySelector('.log');
        if (log) log.scrollTop = log.scrollHeight;
    }

    template = (): Template => tpl`
        <p class="note">
            Elemix batches renders asynchronously, so a new message is not in the
            DOM yet inside <code>send()</code>. <code>onMutation()</code> fires
            right after the DOM is written, making it the correct place to scroll
            this log to the bottom.
        </p>
        <div class="log">
            ${repeat(
                this.state.messages,
                (m) => tpl`<div class=${{ msg: true, me: m.me }}>${m.text}</div>`,
                (m) => m.id,
            )}
        </div>
        <div class="composer">
            <input
                type="text"
                placeholder="Type a message…"
                ~model=${this.state.draft}
                @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') this.send();
                }}
            />
            <button @click=${this.send}>Send</button>
        </div>
    `;
}

defineComponent('chat-app', ChatApp);
