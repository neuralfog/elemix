import { Component, tpl } from '@neuralfog/elemix';
// #component #tag bindings
export class Bindings extends Component {
    template = () => tpl`
        <input ~model=${this.state.value} ~onmodel=${this.clamp} @input=${this.onInput} :ref=${this.field} :count=${this.n} />
    `;
}
