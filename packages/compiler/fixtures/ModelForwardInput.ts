import { Component, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

type Props = {
    model: Ref<string>;
};

// #component
export class ModelForwardInput extends Component<Props> {
    template = (): Template => tpl`
        <input class="in" ~model=${this.props.model} />
    `;
}
