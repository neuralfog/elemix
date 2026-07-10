import { Component, tpl } from '@neuralfog/elemix';
// #component #tag single-line
export class SingleLine extends Component {
    template = () => tpl`<button   @click=${this.go}  >go ${this.label}</button>`;
}
