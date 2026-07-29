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

    // #before-mount
    prepareA(): void {
        record('before-1');
    }

    // #before-mount
    prepareB(): void {
        record('before-2');
    }

    // #effect
    trackA(): void {
        this.setAttribute(
            'data-fx',
            (this.getAttribute('data-fx') ?? '') + `A${this.props.tick}`,
        );
    }

    // #effect
    trackB(): void {
        this.setAttribute(
            'data-fx',
            (this.getAttribute('data-fx') ?? '') + `B${this.props.tick}`,
        );
    }

    // #mount
    readyA(): void {
        record('mount-1');
    }

    // #mount
    readyB(): void {
        record('mount-2');
    }

    // #dispose
    cleanupA(): void {
        record('dispose-1');
    }

    // #dispose
    cleanupB(): void {
        record('dispose-2');
    }

    template = (): Template =>
        tpl`<div class="child">Child · tick ${this.props.tick}</div>`;
}

