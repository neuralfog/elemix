import { Component, csrf, param, query, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class IsoContext extends Component {
    template = (): Template => tpl`
        <div class="iso-ctx">
            <span class="token">${param('token') ?? '-'}</span>
            <span class="q">${query('q') ?? '-'}</span>
            <span class="csrf">${csrf()}</span>
        </div>
    `;
}
