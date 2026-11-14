import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './PropSafeChild';

// #component
export class PropSafeApp extends Component {
    // #state
    state: { label: string } = { label: 'hello' };

    bump = (): void => {
        this.state.label = 'world';
    };

    template = (): Template => tpl`
        <prop-safe-child :label=${this.state.label} />
        <button @click=${this.bump}>bump</button>
    `;
}
