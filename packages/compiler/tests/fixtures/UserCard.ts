import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    name: string;
    role: string;
};

const css = `
    :host { display: block; }
    .card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
    }
    .name { font-weight: 700; }
    .role { font-size: 12px; color: #64748b; }
`;

export class UserCard extends Component<Props> {
    static styles = [css];

    template = (): Template => tpl`<div class="card">
        <span class="name">${this.props.name}</span>
        <span class="role">${this.props.role}</span>
    </div>`;
}

defineComponent('user-card', UserCard);
