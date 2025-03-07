import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';

@component()
export class MultipleRootNodes extends Component {
    template = (): Template => {
        return html`
            <div>Hello There!!</div>
            <div>Hello There!!</div>
            <div>Hello There!!</div>
        `;
    };
}
