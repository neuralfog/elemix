import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    index: number;
    text: string;
};

const css = `
    :host { display: block; }
    .para {
        margin: 0;
        padding: 12px 16px;
        border-left: 3px solid #6366f1;
        border-radius: 6px;
        background: #ffffff;
        color: #1e293b;
        font: 14px/1.6 system-ui, sans-serif;
    }
`;

// #component
export class LoremParagraphStyled extends Component<Props> {
    // #styles
    styles = css;

    template = (): Template =>
        tpl`<p class="para">${this.props.index}: ${this.props.text}</p>`;
}
