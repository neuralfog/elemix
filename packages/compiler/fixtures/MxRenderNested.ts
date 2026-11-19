import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Inner = { id: number; v: string };
type Group = { id: number; name: string; items: Inner[] };

// #component
export class MxRenderNested extends Component {
    groups: Group[] = [
        {
            id: 1,
            name: 'g1',
            items: [
                { id: 11, v: 'a' },
                { id: 12, v: 'b' },
            ],
        },
        { id: 2, name: 'g2', items: [{ id: 21, v: 'c' }] },
    ];
    next = 100;

    editInner = (): void => {
        this.groups[0].items[0].v = `${this.groups[0].items[0].v}!`;
        this.render();
    };

    addInner = (): void => {
        this.groups[0].items.push({ id: this.next++, v: 'z' });
        this.render();
    };

    editOuter = (): void => {
        this.groups[0].name = `${this.groups[0].name}!`;
        this.render();
    };

    template = (): Template => tpl`
        <ul class="groups">
            ${repeat(
                this.groups,
                (g) => tpl`
                    <li class="group" data-id=${g.id}>
                        <span class="gname">${g.name}</span>
                        <ul class="items">
                            ${repeat(
                                g.items,
                                (it) => tpl`
                                    <li class="item" data-id=${it.id}>
                                        ${it.v}
                                    </li>
                                `,
                                (it) => it.id,
                            )}
                        </ul>
                    </li>
                `,
                (g) => g.id,
            )}
        </ul>
        <button class="edit-inner" @click=${this.editInner}>edit inner</button>
        <button class="add-inner" @click=${this.addInner}>add inner</button>
        <button class="edit-outer" @click=${this.editOuter}>edit outer</button>
    `;
}
