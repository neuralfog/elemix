import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { ref } from '../../src/utilities';
import { state } from '../../src/State';

export class ViewModelBindingApp extends Component {
    state = state({
        input: ref(''),
    });

    template = (): Template => {
        return html` <h1>RefApp</h1>
            <p>${this.state.input.value}</p>
            <input type="text" ~model=${this.state.input} />`;
    };
}

defineComponent('view-model-binding-app', ViewModelBindingApp);
