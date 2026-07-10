import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag user-card
export class UserCard extends Component {
    template = (): Template => tpl`<div class="card"><img src=${this.avatar} alt="avatar" /><h2>${this.name}</h2><button @click=${this.follow}>Follow</button></div>`;
}
