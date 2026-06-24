import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag state-app
export class StateApp extends Component {
    // #state
    state = { label: 'hi', enabled: true };

    // `:name` wants string. `label` (string) is fine; `enabled` (boolean) from
    // the same state object must be flagged — props are checked through state.
    template = (): Template => tpl`
        <user-card :name=${this.state.label} :count=${42}></user-card>
        <user-card :name=${this.state.enabled} :count=${7}></user-card>
    `;
}
