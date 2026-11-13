import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './MxCounterChild';

type State = { mounted: boolean };

// #component
export class MxLiveChildTeardown extends Component {
    // #state
    state: State = { mounted: true };

    toggle = (): void => {
        this.state.mounted = !this.state.mounted;
    };

    template = (): Template => tpl`
        <div class="host">
            <button id="toggle-child" @click=${this.toggle}>toggle</button> ${
                this.state.mounted
                    ? tpl`<mx-counter-child :label=${'live'}></mx-counter-child>`
                    : tpl`<span class="gone">gone</span>`
            }
        </div>
    `;
}
