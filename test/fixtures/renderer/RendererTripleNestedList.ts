import { repeat } from '../../../src/renderer/directives';
import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';
import { state } from '../../../src/State';

export class RendererTrippleNestedList extends Component {
    state = state({
        list: ['Emily Johnson', 'Michael Smith'],
    });

    template = (): Template => {
        return html`<ul>
            ${repeat(
                this.state.list,
                (val) => html`
                <li>${val}
                    <ul>
                        ${repeat(
                            this.state.list,
                            (val) => html`
                            <li>${val}
                                <ul>
                                    ${repeat(this.state.list, (val) => html`<li>${val}</li>`)}
                                </ul>
                            </li>`,
                        )}
                    </ul>
                </li>`,
            )}
        </ul>`;
    };
}

defineComponent('renderer-tripple-nested-list', RendererTrippleNestedList);
