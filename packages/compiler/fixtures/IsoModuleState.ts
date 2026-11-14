import { Component, param, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { isoProbe } from './isoProbe';

// #component
export class IsoModuleState extends Component {
    // #before-mount
    seed(): void {
        isoProbe.seen.push(param('token') ?? '-');
    }

    template = (): Template => tpl`
        <div class="iso-module">
            <span class="count">${isoProbe.seen.length}</span>
            <span class="seen">${isoProbe.seen.join('|')}</span>
            <span class="token">${param('token') ?? '-'}</span>
        </div>
    `;
}
