import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';

import './TestComp';

@component({ tag: 'list-app' })
export class ListApp extends Component {
    @state()
    state = {
        count: 1,
    };

    template = (): Template => {
        return html`
            <h1>ListApp</h1>
            <ul>
                ${Array.from(Array(this.state.count).keys()).map(
                    () => html`<li><test-comp /></li>`,
                )}
            </ul>
        `;
    };
}
