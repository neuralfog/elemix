import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class PollutionProbe extends Component {
    check = (): string =>
        ({} as Record<string, unknown>).polluted === undefined
            ? 'clean'
            : 'POLLUTED';

    template = (): Template => tpl`
        <span class="pollution">${this.check()}</span>
    `;
}
