import { Component, tpl } from '@neuralfog/elemix';
import { when } from '@neuralfog/elemix/directives';
// #component #tag directives
export class Directives extends Component {
    template = () => tpl`<div>${when(this.state.open, () => tpl`<span>open</span>`)}</div>`;
}
