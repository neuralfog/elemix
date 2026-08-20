import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './ResetProbeLight';

// #component
export class ResetMixed extends Component {
    // #styles
    styles = ':host { display: block; }';

    template = (): Template => tpl`
        <span class="reset-probe" data-part="shadow">shadow</span>
        <reset-probe-light></reset-probe-light>
    `;
}
