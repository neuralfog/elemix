import { Component, param, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class AttackProbe extends Component {
    template = (): Template => tpl`
        <div class="attack">
            <span class="text">${param('p') ?? ''}</span>
            <a class="attr" title=${param('p') ?? ''}>link</a>
            <input class="val" value=${param('p') ?? ''} />
        </div>
    `;
}
