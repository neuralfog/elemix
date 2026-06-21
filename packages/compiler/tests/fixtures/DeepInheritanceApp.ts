import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// Deep component inheritance across FOUR levels: `DeepLeaf extends DeepLeg
// extends DeepMiddle extends DeepBase`. State, the template and methods come for
// free via the prototype; the compiler chains `super` at EVERY level so each
// ancestor's lifecycle hooks still fire and every stylesheet up the chain gets
// adopted (merged off the prototype), not replaced.

// each level adds one sheet, all targeting `.btn` directly (a <button> resets
// inherited color/font, so :host wouldn't show): base paints it red, the middle
// sheet adds bold, the leg italicises, the leaf underlines — all four must stack.
const baseCss =
    ':host { display: block; } .btn { background: rgb(220, 38, 38); color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; }';
const middleCss = '.btn { font-weight: 700; }';
const legCss = '.btn { font-style: italic; }';
const leafCss = '.btn { text-decoration-line: underline; }';

// #component
export class DeepBase extends Component {
    // #styles
    styles = baseCss;

    // #state
    state = { count: 0 };

    // #mount
    baseMounted(): void {
        this.setAttribute('data-base', 'on');
    }

    // #effect
    mirrorBase(): void {
        this.setAttribute('data-base-fx', String(this.state.count));
    }

    bump = (): void => {
        this.state.count++;
    };

    template = (): Template => tpl`
        <button class="btn" @click=${this.bump}>count ${this.state.count}</button>
    `;
}

// #component
export class DeepMiddle extends DeepBase {
    // #styles
    middleStyles = middleCss;

    // #mount
    middleMounted(): void {
        this.setAttribute('data-middle', 'on');
    }

    // #effect
    mirrorMiddle(): void {
        this.setAttribute('data-middle-fx', String(this.state.count));
    }
}

// #component
export class DeepLeg extends DeepMiddle {
    // #styles
    legStyles = legCss;

    // #mount
    legMounted(): void {
        this.setAttribute('data-leg', 'on');
    }

    // #effect
    mirrorLeg(): void {
        this.setAttribute('data-leg-fx', String(this.state.count));
    }
}

// #component
export class DeepLeaf extends DeepLeg {
    // #styles
    leafStyles = leafCss;

    // #mount
    leafMounted(): void {
        this.setAttribute('data-leaf', 'on');
    }

    // #effect
    mirrorLeaf(): void {
        this.setAttribute('data-leaf-fx', String(this.state.count));
    }
}
