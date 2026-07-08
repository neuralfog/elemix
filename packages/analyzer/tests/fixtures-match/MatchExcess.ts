import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
type S = 'a' | 'b';
// #component
export class MatchExcess extends Component {
    // #state
    state = { s: 'a' as S };
    template = (): Template => tpl`<div>${match(this.state.s, {
        a: () => tpl`<span>a</span>`,
        b: () => tpl`<span>b</span>`,
        c: () => tpl`<span>c</span>`,
    })}</div>`;
}
