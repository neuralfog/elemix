import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { repeat } from '../../directives';

@component()
export class StateApp extends Component {
    @state()
    state = {
        string: 'Initial Value',
        number: 0,
        null: null,
        undefined: undefined,
        list: ['apple', 'orange'],
        any: undefined as any,
        object: {
            nested: {
                value: 'Initial Value',
            },
        },
    };

    onRender = (_renderTrigger?: string[]): void => {};

    onDispose = (): void => {};

    template = (): Template => {
        return html`
            <h1>StateApp</h1>
            <p>${this.state.string}</p>
            <p>${this.state.number}</p>
            <p>${String(this.state.null)}</p>
            <p>${String(this.state.undefined)}</p>
            <p>${this.state.object.nested.value}</p>
            <ul>
                ${repeat(
                    this.state.list,
                    (val: string) => html`<li>${val}</li>`,
                )}
            </ul>
        `;
    };
}
