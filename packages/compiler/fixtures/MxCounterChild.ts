import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

type Props = { label: string };

// #component
export class MxCounterChild extends Component<Props> {
    // #state
    local: { count: number } = { count: 0 };

    bump = (): void => {
        this.local.count += 1;
    };

    template = (): Template => tpl`
        <div class="child" data-label=${this.props.label}>
            <span class="child-label">${this.props.label}</span>
            <span class="child-count">${this.local.count}</span>
            <button class="child-bump" @click=${this.bump}>bump</button>
        </div>
    `;
}
