import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag al-orphan
export class Orphan extends Component {
    template = (): Template => tpl`<span>orphan</span>`;
}
