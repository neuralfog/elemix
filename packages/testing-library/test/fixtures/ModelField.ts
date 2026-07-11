import { Component, ref, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

// #component
export class ModelField extends Component {
    // #state
    state: { name: Ref<string> } = { name: ref('') };

    template = (): Template => tpl`
        <input class="field" type="text" ~model=${this.state.name} />
        <span class="echo">${this.state.name.value}</span>
    `;
}
