import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { counter } from './SignalStore';

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .value {
        margin-bottom: 16px;
        font-size: 64px;
        font-weight: 800;
        line-height: 1;
        text-align: center;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
    }
`;

export class SignalValue extends Component {
    static styles = [css];

    template = (): Template => tpl`<div class="value">${counter.count}</div>`;
}

defineComponent('signal-value', SignalValue);
