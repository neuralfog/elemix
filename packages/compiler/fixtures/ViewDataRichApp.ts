import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

export type RichData = {
    str: string;
    num: number;
    bool: boolean;
    nil: null;
    tags: string[];
    scores: number[];
    obj: { a: string; b: number };
    nested: { deep: { value: string } };
    rows: Array<{ id: number; label: string }>;
};

// #component
export class ViewDataRichApp extends Component<unknown, RichData> {
    template = (): Template => tpl`
        <div class="rich">
            <span class="str">${this.viewData.str}</span>
            <span class="num">${this.viewData.num}</span>
            <span class="bool">${this.viewData.bool ? 'yes' : 'no'}</span>
            <span class="nil">${this.viewData.nil ?? 'none'}</span>
            <span class="tags">${this.viewData.tags.join(',')}</span>
            <span class="scores-len">${this.viewData.scores.length}</span>
            <span class="scores-sum">${this.viewData.scores.reduce(
                (a, b) => a + b,
                0,
            )}</span>
            <span class="obj-a">${this.viewData.obj.a}</span>
            <span class="obj-b">${this.viewData.obj.b}</span>
            <span class="deep">${this.viewData.nested.deep.value}</span>
            <ul class="rows">
                ${repeat(
                    this.viewData.rows,
                    (row) => tpl`<li class="row">${row.id}:${row.label}</li>`,
                    (row) => row.id,
                )}
            </ul>
        </div>
    `;
}
