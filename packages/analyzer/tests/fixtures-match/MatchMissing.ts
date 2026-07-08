import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
type Status = 'idle' | 'loading' | 'ready' | 'failed';
// #component
export class MatchMissing extends Component {
    // #state
    state = { status: 'idle' as Status };
    template = (): Template => tpl`<div>${match(this.state.status, {
        idle: () => tpl`<span>i</span>`,
        loading: () => tpl`<span>l</span>`,
        ready: () => tpl`<span>r</span>`,
    })}</div>`;
}
