import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    index: number;
    text: string;
};

// #component
export class LoremParagraph extends Component<Props> {
    template = (): Template =>
        tpl`<p class="para">${this.props.index}: ${this.props.text}</p>`;
}
