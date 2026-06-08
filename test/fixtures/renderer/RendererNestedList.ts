import { repeat } from '../../../src/renderer/directives';
import { Component } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { component } from '../../../src/decorators/component';
import { state } from '../../../src/State';

@component()
export class RendererNestedList extends Component {
    state = state({
        list: ['Emily Johnson', 'Michael Smith', 'Olivia Davis'],
    });

    template = (): Template => {
        return html`<ul>
            ${repeat(
                this.state.list,
                (val) => html`
                <li>${val}
                    <ul>
                        ${repeat(this.state.list, (val) => html`<li>${val}</li>`)}
                    </ul>
                </li>`,
            )}
        </ul>`;
    };
}
