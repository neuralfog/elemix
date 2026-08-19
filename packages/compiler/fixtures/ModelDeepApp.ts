import { Component, ref, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

import './ModelDeepOuter';

type State = {
    name: Ref<string>;
};

// #component
export class ModelDeepApp extends Component {
    // #state
    state: State = {
        name: ref('Ada'),
    };

    template = (): Template => tpl`
        <model-deep-outer :model=${this.state.name} />
        <div class="out">Hello, ${this.state.name.value}</div>
    `;
}
