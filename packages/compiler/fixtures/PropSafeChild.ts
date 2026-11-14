import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = { label: string };

// #component
export class PropSafeChild extends Component<Props> {
    template = (): Template => tpl`<span class="lbl">${this.props.label}</span>`;
}
