import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    name: string;
    count: number;
};

// #component #tag user-card
export class UserCard extends Component<Props> {
    template = (): Template =>
        tpl`<div>${this.props.name} ${this.props.count}</div>`;
}
