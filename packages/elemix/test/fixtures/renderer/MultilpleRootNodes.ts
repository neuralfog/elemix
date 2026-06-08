import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';

export class MultipleRootNodes extends Component {
    template = (): Template => {
        return html`
            <div>Hello There!!</div>
            <div>Hello There!!</div>
            <div>Hello There!!</div>
        `;
    };
}

defineComponent('multiple-root-nodes', MultipleRootNodes);
