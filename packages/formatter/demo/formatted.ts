import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag user-badge
export class UserBadge extends Component {
    template = (): Template => tpl`
        <span class="badge">
            <img src=${this.avatar} alt="avatar" />
            <strong>${this.name}</strong>
        </span>
    `;
}
