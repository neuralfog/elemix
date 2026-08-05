import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class BarePage extends Component {
    override template = (): Template => tpl`<p>bare</p>`;
}
