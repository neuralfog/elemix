import { Component, defineComponent } from '../../src/component/Component';
import type { Template } from '../../src/types';
import { html } from '../../src/types';

export class StyledHost extends Component {
    static styles = ['.styled-host { color: red; }'];

    template = (): Template => html`<div class="styled-host">styled</div>`;
}

defineComponent('styled-host', StyledHost);

export class UnstyledHost extends Component {
    template = (): Template => html`<div>plain</div>`;
}

defineComponent('unstyled-host', UnstyledHost);

export class MultiStyledHost extends Component {
    static styles = ['.first { color: red; }', '.second { color: blue; }'];

    template = (): Template => html`<div class="first second">multi</div>`;
}

defineComponent('multi-styled-host', MultiStyledHost);

export class SlotHost extends Component {
    template = (): Template => html`
        <div>
            <slot name="icon"></slot>
            <slot name="text"></slot>
            <slot></slot>
        </div>
    `;
}

defineComponent('slot-host', SlotHost);
