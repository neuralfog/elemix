import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';

@component()
export class SelfClosed extends Component {
    template = (): Template => {
        return html`<div>Self Closed!!</div>`;
    };
}
