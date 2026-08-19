import { Component, tpl } from '@neuralfog/elemix';
import type { Ref, Template } from '@neuralfog/elemix/types';

import './ModelDeepInner';

type Props = {
    model: Ref<string>;
};

// #component
export class ModelDeepMiddle extends Component<Props> {
    template = (): Template => tpl`
        <model-deep-inner :model=${this.props.model} />
    `;
}
