import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag state-app
export class StateApp extends Component {
    // #state
    state = { label: 'hi', enabled: true };

    template = (): Template => tpl`
        <user-card :name=${this.state.label} :count=${42}></user-card>
        <user-card :name=${this.state.enabled} :count=${7}></user-card>
    `;
}
