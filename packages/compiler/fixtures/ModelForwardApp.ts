import { Component, ref, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

import './ModelForwardInput';

type State = {
    name: Ref<string>;
};

// #component
export class ModelForwardApp extends Component {
    // #state
    state: State = {
        name: ref('Ada'),
    };

    template = (): Template => tpl`
        <model-forward-input :model=${this.state.name} />
        <div class="out">Hello, ${this.state.name.value}</div>
    `;
}
