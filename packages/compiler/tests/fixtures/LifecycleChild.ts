import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { record } from './LifecycleStore';

type ChildProps = { tick: number };

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .child {
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 10px;
    }
`;

// #component
export class LifecycleChild extends Component<ChildProps> {
    // #styles
    styles = css;

    beforeMount(): void {
        record('beforeMount');
    }

    onMount(): void {
        record('onMount');
    }

    onDispose(): void {
        record('onDispose');
    }

    template = (): Template =>
        tpl`<div class="child">Child · tick ${this.props.tick}</div>`;
}

