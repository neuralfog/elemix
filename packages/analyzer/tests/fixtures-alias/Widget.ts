import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag al-widget
export class Widget extends Component {
    template = (): Template => tpl`<span>widget</span>`;
}
