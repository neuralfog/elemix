import { Component } from '../../src/component/Component';
import { component } from '../../src/decorators/component';
import type { Template } from '../../src/types';
import { html } from '../../src/types';

@component({ styles: ['.styled-host { color: red; }'] })
export class StyledHost extends Component {
    template = (): Template => html`<div class="styled-host">styled</div>`;
}

@component()
export class UnstyledHost extends Component {
    template = (): Template => html`<div>plain</div>`;
}

@component({ styles: ['.first { color: red; }', '.second { color: blue; }'] })
export class MultiStyledHost extends Component {
    template = (): Template => html`<div class="first second">multi</div>`;
}

@component()
export class SlotHost extends Component {
    template = (): Template => html`
        <div>
            <slot name="icon"></slot>
            <slot name="text"></slot>
            <slot></slot>
        </div>
    `;
}
