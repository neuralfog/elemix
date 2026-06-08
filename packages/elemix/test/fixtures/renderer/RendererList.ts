import { repeat } from '../../../src/renderer/directives';
import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { state } from '../../../src/State';

export class RendererList extends Component {
    state = state({
        list: [
            'Emily Johnson',
            'Michael Smith',
            'Olivia Davis',
            'Benjamin Williams',
            'Sophia Brown',
        ],
    });

    template = (): Template => {
        return html`<ul>
            ${repeat(this.state.list, (val) => html`<li>${val}</li>`)}
        </ul>`;
    };
}

defineComponent('renderer-list', RendererList);
