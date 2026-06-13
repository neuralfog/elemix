import { Component, defineComponent, ref, state, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

import './ProfileCard';

type State = {
    name: Ref<string>;
    role: Ref<string>;
    likes: number;
};

const css = `
    :host { --accent: #6366f1; display: block; font-family: system-ui, sans-serif; }
    .controls {
        display: flex; flex-wrap: wrap; gap: 12px;
        align-items: flex-end; margin-bottom: 20px;
    }
    label {
        display: flex; flex-direction: column; gap: 4px;
        font-size: 12px; color: #64748b;
    }
    input {
        font: inherit; font-size: 14px; padding: 7px 10px;
        border: 1px solid #cbd5e1; border-radius: 8px; outline: none;
    }
    input:focus { border-color: var(--accent); }
    button {
        font: inherit; padding: 8px 14px; border: none; border-radius: 8px;
        background: var(--accent); color: white; cursor: pointer;
    }
    button:hover { background: #4f46e5; }
`;

export class ProfileApp extends Component {
    static styles = [css];

    state = state<State>({
        name: ref('Ada Lovelace'),
        role: ref('Engineer'),
        likes: 0,
    });

    like = (): void => {
        this.state.likes++;
    };

    template = (): Template => tpl`
        <div class="controls">
            <label>
                Name
                <input type="text" ~model=${this.state.name} />
            </label>
            <label>
                Role
                <input type="text" ~model=${this.state.role} />
            </label>
            <button @click=${this.like}>👍 Like</button>
        </div>
        <profile-card
            :name=${this.state.name.value}
            :role=${this.state.role.value}
            :likes=${this.state.likes}
        />
    `;
}

defineComponent('profile-app', ProfileApp);
