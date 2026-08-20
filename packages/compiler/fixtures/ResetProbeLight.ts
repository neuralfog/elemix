import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #no-shadow
export class ResetProbeLight extends Component {
    template = (): Template => tpl`<span class="reset-probe">probe</span>`;
}
