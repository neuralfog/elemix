import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = { title: string };

// #component #tag lone-widget
export class LoneWidget extends Component<Props> {
    template = (): Template => tpl`<span>${this.props.title}</span>`;
}
