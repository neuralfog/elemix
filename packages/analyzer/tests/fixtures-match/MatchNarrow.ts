import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
type Load = { k: 'idle' } | { k: 'busy'; pct: number };
// #component
export class MatchNarrow extends Component {
    // #state
    state: { load: Load } = { load: { k: 'idle' } };
    template = (): Template => tpl`<div>${match(this.state.load, 'k', {
        idle: () => tpl`<span>idle</span>`,
        busy: (m) => tpl`<span>${m.nope}</span>`,
    })}</div>`;
}
