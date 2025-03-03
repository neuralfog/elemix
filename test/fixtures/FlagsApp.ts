import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { signalWithFlag } from './signalCustomFlag';

export const CUSTOM_STATE_FLAG_1 = 'user defined state flag 1';
export const CUSTOM_STATE_FLAG_2 = 'user defined state flag 2';

@component({ tag: 'flags-app', signals: [signalWithFlag] })
export class FlagsApp extends Component {
    @state(CUSTOM_STATE_FLAG_1)
    state = {
        value: '',
    };

    @state(CUSTOM_STATE_FLAG_2)
    state2 = {
        value: '',
    };

    onRender = (_renderTrigger?: string[]): void => {};

    template = (): Template => {
        return html` <h1>FlagsApp</h1> `;
    };
}
