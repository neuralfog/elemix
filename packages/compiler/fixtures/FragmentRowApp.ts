import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Group = { id: string; items: string[] };

// #component
export class FragmentRowApp extends Component {
    // #state
    state: { groups: Group[] } = {
        groups: [
            { id: 'g1', items: ['a', 'b'] },
            { id: 'g2', items: ['c', 'd'] },
        ],
    };

    prependInner = (): void => {
        this.state.groups[0].items.unshift('z');
    };

    reverseOuter = (): void => {
        this.state.groups = this.state.groups.slice().reverse();
    };

    template = (): Template => tpl`
        <div class="rows">
            ${repeat(
                this.state.groups,
                (group) => tpl`
                    ${repeat(
                        group.items,
                        (item) => tpl`<span class="inner">${item}</span>`,
                        (item) => item,
                    )}
                    <span class="tail">end-${group.id}</span>
                `,
                (group) => group.id,
            )}
        </div>
        <button class="prepend" @click=${this.prependInner}>prepend</button>
        <button class="reverse" @click=${this.reverseOuter}>reverse</button>
    `;
}
