import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { ref } from '../../src/utilities';
import { state } from '../../src/decorators/state';

@component({ tag: 'view-model-binding-app' })
export class ViewModelBinding extends Component {
    @state()
    state = {
        input: ref(''),
    };

    template = (): Template => {
        return html` <h1>RefApp</h1>
            <p>${this.state.input.value}</p>
            <input type="text" ~model=${this.state.input} />`;
    };
}
