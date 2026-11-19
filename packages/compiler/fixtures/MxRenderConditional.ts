import { Component, tpl } from '@neuralfog/elemix';
import { choose, when } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class MxRenderConditional extends Component {
    s = { show: false, n: 0, inner: 'x' };

    toggle = (): void => {
        this.s.show = !this.s.show;
        this.render();
    };

    editInner = (): void => {
        this.s.inner = `${this.s.inner}!`;
        this.render();
    };

    grade = (): void => {
        this.s.n = (this.s.n + 1) % 3;
        this.render();
    };

    template = (): Template => tpl`
        <div class="when">
            ${when(
                this.s.show,
                () => tpl`<span class="shown">${this.s.inner}</span>`,
                () => tpl`<span class="hidden">off</span>`,
            )}
        </div>
        <div class="choose">
            ${choose([
                [this.s.n === 0, () => tpl`<span class="zero">zero</span>`],
                [this.s.n === 1, () => tpl`<span class="one">one</span>`],
                [true, () => tpl`<span class="two">two</span>`],
            ])}
        </div>
        <button class="toggle" @click=${this.toggle}>toggle</button>
        <button class="edit-inner" @click=${this.editInner}>edit inner</button>
        <button class="grade" @click=${this.grade}>grade</button>
    `;
}
