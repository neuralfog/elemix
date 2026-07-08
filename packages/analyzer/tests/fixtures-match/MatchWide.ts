import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
// #component
export class MatchWide extends Component {
    // #state
    state: { s: string } = { s: 'x' };
    template = (): Template => tpl`<div>${match(this.state.s, { x: () => tpl`<span>x</span>` })}</div>`;
}
