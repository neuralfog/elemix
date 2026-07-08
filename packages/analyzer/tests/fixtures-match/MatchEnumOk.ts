import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';
enum Color { Red, Green }
// #component
export class MatchEnumOk extends Component {
    // #state
    state = { c: Color.Red };
    template = (): Template => tpl`<div>${match(this.state.c, { [Color.Red]: () => tpl`<span>r</span>`, [Color.Green]: () => tpl`<span>g</span>` })}</div>`;
}
