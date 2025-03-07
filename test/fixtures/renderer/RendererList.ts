import { repeat } from '@neuralfog/elemix-renderer/directives';
import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';
import { state } from '../../../decorators';

@component()
export class RendererList extends Component {
    @state()
    state = {
        list: [
            'Emily Johnson',
            'Michael Smith',
            'Olivia Davis',
            'Benjamin Williams',
            'Sophia Brown',
        ],
    };

    template = (): Template => {
        return html`<ul>
            ${repeat(this.state.list, (val) => html`<li>${val}</li>`)}
        </ul>`;
    };
}
