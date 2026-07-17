import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Item = { id: string; icon: () => Template };

const items: Item[] = [
    { id: 'a', icon: () => tpl`<i class="icon icon-a"></i>` },
    { id: 'b', icon: () => tpl`<i class="icon icon-b"></i>` },
];

const badge = (): Template => tpl`<b class="badge">NEW</b>`;

type State = { fancy: boolean };

// #component
export class DynamicChildApp extends Component {
    // #state
    state: State = { fancy: false };

    private get pick(): string | Template {
        return this.state.fancy ? badge() : 'plain';
    }

    toggle = (): void => {
        this.state.fancy = !this.state.fancy;
    };

    template(): Template {
        return tpl`
            <div class="icons">
                ${repeat(
                    items,
                    (it) =>
                        tpl`<span class="row" data-id=${it.id}>${it.icon()}</span>`,
                    (it) => it.id,
                )}
            </div>
            <div class="swap">${this.pick}</div>
            <button class="toggle" @click=${this.toggle}>toggle</button>
        `;
    }
}
