import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag state-targets-app
export class StateTargetsApp extends Component {
    // `#state` tags reactive DATA — never a function or a method.

    // #state — a data field is fine.
    count = 0;

    // #state — on an arrow-function field → ERROR.
    bad = (): void => {};

    // #state — on a method → ERROR.
    alsoBad(): void {}

    template = (): Template => tpl`<div>${this.state.count}</div>`;
}
