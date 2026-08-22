import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Group = {
    id: string;
    items: string[];
};

type State = {
    groups: Group[];
};

// #component
export class MultiRootRowApp extends Component {
    // #state
    state: State = {
        groups: [
            { id: 'g1', items: ['a', 'b'] },
            { id: 'g2', items: ['c'] },
        ],
    };

    addGroup = (): void => {
        this.state.groups.push({
            id: `g${this.state.groups.length + 1}`,
            items: ['z'],
        });
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
        <button class="add" @click=${this.addGroup}>add</button>
    `;
}
