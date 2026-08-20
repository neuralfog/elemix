import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class ResetProbe extends Component {
    // #styles
    styles = ':host { display: block; }';

    template = (): Template => tpl`<span class="reset-probe">probe</span>`;
}
