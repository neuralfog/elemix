import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import './SsrCycleProbe';
import { cycle } from './SsrCycleStore';

type State = { mounted: boolean };

// #component
export class SsrCycleApp extends Component {
    // #state
    state: State = { mounted: true };

    toggle = (): void => {
        this.state.mounted = !this.state.mounted;
    };

    template = (): Template => tpl`
        <div class="stage">
            ${
                this.state.mounted
                    ? tpl`<ssr-cycle-probe />`
                    : tpl`<span class="empty">unmounted</span>`
            }
        </div>
        <button class="toggle" @click=${this.toggle}>toggle</button>
        <ul class="log">
            ${repeat(
                cycle.entries,
                (entry) => tpl`<li>${entry.event}</li>`,
                (entry) => String(entry.id),
            )}
        </ul>
    `;
}
