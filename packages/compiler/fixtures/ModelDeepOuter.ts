import { Component, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

import './ModelDeepMiddle';

type Props = {
    model: Ref<string>;
};

// #component
export class ModelDeepOuter extends Component<Props> {
    template = (): Template => tpl`
        <model-deep-middle :model=${this.props.model} />
    `;
}
