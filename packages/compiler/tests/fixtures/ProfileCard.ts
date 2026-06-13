import { Component, defineComponent, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = {
    name: string;
    role: string;
    likes: number;
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    .card {
        display: flex; align-items: center; gap: 14px; max-width: 360px;
        padding: 16px; border-radius: 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white; box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);
    }
    .avatar {
        flex: 0 0 48px; height: 48px; display: grid; place-items: center;
        border-radius: 50%; background: rgba(255, 255, 255, 0.2);
        font-size: 20px; font-weight: 700;
    }
    .info { display: flex; flex-direction: column; }
    .info strong { font-size: 16px; }
    .info span { font-size: 13px; opacity: 0.85; }
    .likes { margin-left: auto; font-size: 15px; font-weight: 600; }
`;

export class ProfileCard extends Component<Props> {
    static styles = [css];

    template = (): Template => tpl`<div class="card">
        <div class="avatar">${this.props.name.charAt(0)}</div>
        <div class="info">
            <strong>${this.props.name}</strong>
            <span>${this.props.role}</span>
        </div>
        <div class="likes">❤️ ${this.props.likes}</div>
    </div>`;
}

defineComponent('profile-card', ProfileCard);
