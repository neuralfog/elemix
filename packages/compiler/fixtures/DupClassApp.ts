import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class DupClassApp extends Component {
    // #state
    state: { cls: string } = { cls: 'btn btn' };

    template = (): Template => tpl`
        <div class=${this.state.cls}>x</div>
    `;
}
