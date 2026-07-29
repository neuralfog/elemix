import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './SsrPropsChild';

type State = {
    count: number;
    tags: string[];
};

// #component
export class SsrPropsAppClientChild extends Component {
    // #state
    state: State = {
        count: 0,
        tags: ['a'],
    };

    bump = (): void => {
        this.state.count++;
    };

    add = (item: string): void => {
        this.state.tags.push(item);
    };

    template = (): Template => tpl`
        <div class="parent">
            count <span class="pcount">${this.state.count}</span>
            tags <span class="ptags">${this.state.tags.join(',')}</span>
        </div>
        <ssr-props-child
            :label=${'hello'}
            :count=${this.state.count}
            :flag=${true}
            :tags=${this.state.tags}
            :onBump=${this.bump}
            :onAdd=${this.add}
        />
    `;
}
