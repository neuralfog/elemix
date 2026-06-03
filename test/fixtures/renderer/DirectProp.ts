import { Component } from '../../../src/component/Component';
import { component } from '../../../src/decorators/component';
import { html, type Template } from '../../../src/types';

@component()
export class DirectPropHost extends Component {
    public inputValue = '';
    public flag = false;
    public count = 0;

    template = (): Template => html`
        <input
            type="text"
            .value=${this.inputValue}
            .disabled=${this.flag}
            .tabIndex=${this.count}
        />
    `;
}

@component()
export class DirectPropObject extends Component {
    public payload: unknown = { foo: 'bar' };

    template = (): Template =>
        html`<x-receiver .data=${this.payload}></x-receiver>`;
}

class XReceiver extends HTMLElement {}
customElements.define('x-receiver', XReceiver);
