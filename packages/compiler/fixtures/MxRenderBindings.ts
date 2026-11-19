import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class MxRenderBindings extends Component {
    s = { text: 'hi', attr: 'a1', cls: 'red', active: false, color: 'blue', size: 10 };

    mut = (): void => {
        this.s.text = 'bye';
        this.s.attr = 'a2';
        this.s.cls = 'green';
        this.s.active = true;
        this.s.color = 'orange';
        this.s.size = 20;
        this.render();
    };

    template = (): Template => tpl`
        <div class="box ${this.s.cls}">
            <span class="text">${this.s.text}</span>
            <span class="attr" data-v=${this.s.attr}>x</span>
            <span
                data-t="obj"
                class=${{ on: this.s.active, base: true }}
            >y</span>
            <span
                class="style"
                style=${{ color: this.s.color, width: `${this.s.size}px` }}
            >z</span>
        </div>
        <button class="mut" @click=${this.mut}>mut</button>
    `;
}
