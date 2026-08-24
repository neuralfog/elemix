import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';


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
