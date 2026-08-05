import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { DocFrame } from './DocFrame';

// #component
export class DocPage extends Component {
    // #document
    document = DocFrame;

    // #state
    count = 0;

    override template = (): Template => tpl`<p>page ${this.count}</p>`;
}
