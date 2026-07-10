import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .label { font-weight: 700; color: #6366f1; }
`;

// Registration + styles via a pragma block — no `static styles`, no manual
// `defineComponent`. The compiler derives the tag (`PragmaApp` → `pragma-app`),
// hoists `sheet(css)`, wires `__sheets`, and emits the `$__defineComponent` call.
// #component
export class PragmaApp extends Component {
    // #styles
    styles = css;
    // #state
    state = { label: 'hello' };

    template = (): Template =>
        tpl`<span class="label">${this.state.label}</span>`;
}
