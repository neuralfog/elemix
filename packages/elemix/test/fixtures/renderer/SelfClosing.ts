import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';

export class SelfClosingChild extends Component {
    template = (): Template => html`<span class="child"><slot></slot></span>`;
}

defineComponent('self-closing-child', SelfClosingChild);

export class SelfClosingHost extends Component {
    template = (): Template => html`
        <div>
            <self-closing-child />
            <self-closing-child />
            <self-closing-child />
        </div>
    `;
}

defineComponent('self-closing-host', SelfClosingHost);

export class SelfClosingSlots extends Component {
    template = (): Template => html`
        <div class="card">
            <slot name="icon"></slot>
            <slot name="text"></slot>
            <slot name="trailing"></slot>
        </div>
    `;
}

defineComponent('self-closing-slots', SelfClosingSlots);

export class SelfClosingSlotHost extends Component {
    template = (): Template => html`
        <self-closing-slots>
            <self-closing-child slot="icon" />
            <span slot="text">Label</span>
            <self-closing-child slot="trailing" />
        </self-closing-slots>
    `;
}

defineComponent('self-closing-slot-host', SelfClosingSlotHost);

export class VoidElementHost extends Component {
    template = (): Template => html`
        <div>
            <br />
            <hr />
            <input type="text" />
        </div>
    `;
}

defineComponent('void-element-host', VoidElementHost);

export class ConditionalSelfClose extends Component {
    public showIcon = false;

    template = (): Template => html`
        <div class="container">
            <span class="leading">leading</span>
            <input type="text" placeholder="search" />
            ${
                this.showIcon
                    ? html`<button class="action">
                          <self-closing-child />
                      </button>`
                    : ''
            }
        </div>
    `;
}

defineComponent('conditional-self-close', ConditionalSelfClose);

export class SearchWithClear extends Component {
    public query = '';

    private clear = (): void => {
        this.query = '';
        this.render();
    };

    template = (): Template => html`
        <div class="search">
            <span class="search-icon">
                <slot name="icon"></slot>
            </span>
            <input
                type="text"
                class="search-input"
                placeholder="Search…"
                value=${this.query}
            />
            ${
                this.query.length
                    ? html`<button
                          type="button"
                          class="search-clear"
                          @click=${this.clear}
                          title="Clear"
                      >
                          <self-closing-child />
                      </button>`
                    : ''
            }
        </div>
    `;
}

defineComponent('search-with-clear', SearchWithClear);
