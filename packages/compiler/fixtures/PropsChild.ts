import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    label: string;
    count: number;
    flag: boolean;
    tags: string[];
    onBump: () => void;
    onAdd: (item: string) => void;
};

// #component
export class PropsChild extends Component<Props> {
    template = (): Template => tpl`<div class="child">
        <span class="label">${this.props.label}</span>
        <span class="count">${this.props.count}</span>
        <span class="flag">${this.props.flag ? 'yes' : 'no'}</span>
        <span class="tags">${this.props.tags.join(',')}</span>
        <button class="bump" @click=${() => this.props.onBump()}>bump</button>
        <button class="add" @click=${() => this.props.onAdd('x')}>add</button>
        <button class="push" @click=${() => this.props.tags.push('y')}>push</button>
    </div>`;
}
