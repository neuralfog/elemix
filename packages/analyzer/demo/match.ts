import { Component, tpl } from '@neuralfog/elemix';
import { match } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Status = 'idle' | 'loading' | 'ready' | 'failed';

// non-exhaustive: the 'failed' case is not handled.
// #component #tag match-missing
export class MatchMissing extends Component {
    // #state
    state = { status: 'idle' as Status };

    template = (): Template => tpl`
        <div>${match(this.state.status, {
            idle: () => tpl`<span>idle</span>`,
            loading: () => tpl`<span>loading</span>`,
            ready: () => tpl`<span>ready</span>`,
        })}</div>
    `;
}

// unknown / misspelled case: 'cancelled' is not a member of Status.
// #component #tag match-typo
export class MatchTypo extends Component {
    // #state
    state = { status: 'idle' as Status };

    template = (): Template => tpl`
        <div>${match(this.state.status, {
            idle: () => tpl`<span>idle</span>`,
            loading: () => tpl`<span>loading</span>`,
            ready: () => tpl`<span>ready</span>`,
            failed: () => tpl`<span>failed</span>`,
            cancelled: () => tpl`<span>cancelled</span>`,
        })}</div>
    `;
}

// widened value: a plain `string` has no finite set of cases.
// #component #tag match-wide
export class MatchWide extends Component {
    // #state
    state: { name: string } = { name: 'x' };

    template = (): Template => tpl`
        <div>${match(this.state.name, {
            x: () => tpl`<span>x</span>`,
        })}</div>
    `;
}

type Load = { kind: 'idle' } | { kind: 'busy'; pct: number };

// discriminated union: a bad member read inside a narrowed arm.
// #component #tag match-narrow
export class MatchNarrow extends Component {
    // #state
    state: { load: Load } = { load: { kind: 'idle' } };

    template = (): Template => tpl`
        <div>${match(this.state.load, 'kind', {
            idle: () => tpl`<span>idle</span>`,
            busy: (m) => tpl`<span>${m.percentage}</span>`,
        })}</div>
    `;
}
