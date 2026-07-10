import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag alert-bar
export class AlertBar extends Component {
    template = (): Template => tpl`<aside class="alert"><strong>Heads up!</strong><p>${this.message}</p></aside>`;
}
