import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// Component inheritance: `InheritDerived extends InheritBase`. State, the
// template and methods come for free via the prototype; the compiler chains
// `super` so the base's lifecycle hooks still fire and both stylesheets get
// adopted (merged off the prototype), not replaced.

// base styles the button red; the derived sheet adds bold on top — both target
// `.btn` directly (a <button> resets inherited color/font, so :host wouldn't show)
const baseCss =
    ':host { display: block; } .btn { background: rgb(220, 38, 38); color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; }';
const derivedCss = '.btn { font-weight: 700; }';

// #component
export class InheritBase extends Component {
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
export class InheritDerived extends InheritBase {
    // #styles
    styles2 = derivedCss;

    // #mount
    derivedMounted(): void {
        this.setAttribute('data-derived', 'on');
    }

    // #effect
    mirrorDerived(): void {
        this.setAttribute('data-derived-fx', String(this.state.count));
    }
}
