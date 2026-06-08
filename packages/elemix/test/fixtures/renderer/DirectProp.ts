import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';

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

defineComponent('direct-prop-host', DirectPropHost);

export class DirectPropObject extends Component {
    public payload: unknown = { foo: 'bar' };

    template = (): Template =>
        html`<x-receiver .data=${this.payload}></x-receiver>`;
}

defineComponent('direct-prop-object', DirectPropObject);

class XReceiver extends HTMLElement {}
customElements.define('x-receiver', XReceiver);
