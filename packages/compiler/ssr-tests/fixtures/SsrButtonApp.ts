import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    label: string;
    tone: string;
};

const css = `button { color: rgb(99, 102, 241); }`;

// #component #tag ssr-button
export class SsrButtonApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = { label: 'Save', tone: 'primary' };

    click = (): void => {
        this.state.label = 'Saved';
    };

    template = (): Template =>
        tpl`<button class=${this.state.tone} @click=${this.click}>${this.state.label}</button>`;
}
