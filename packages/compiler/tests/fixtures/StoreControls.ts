import { Component, defineComponent } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    counter: { value: number };
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
    }
    .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
    }
    .buttons { display: flex; align-items: center; gap: 14px; }
    button {
        width: 38px;
        height: 38px;
        font-size: 20px;
        border: none;
        border-radius: 10px;
        background: var(--accent, #6366f1);
        color: white;
        cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    .value {
        min-width: 32px;
        font-size: 22px;
        font-weight: 700;
        text-align: center;
    }
`;

export class StoreControls extends Component<Props> {
    static styles = [css];

    dec = (): void => {
        this.props.counter.value--;
    };

    inc = (): void => {
        this.props.counter.value++;
    };

    template = (): Template => tpl`<div class="panel">
        <span class="label">Child controls</span>
        <div class="buttons">
            <button @click=${this.dec}>−</button>
            <span class="value">${this.props.counter.value}</span>
            <button @click=${this.inc}>+</button>
        </div>
    </div>`;
}

defineComponent('store-controls', StoreControls);
