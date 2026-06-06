import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { state } from '../../src/decorators/state';
import { signal } from '../../src/Signal';
import { repeat } from '../../directives';

export const mutationSignal = signal({ label: 'initial' });

export const resetMutationSignal = (): void => {
    mutationSignal.value.label = 'initial';
    mutationSignal.subscribers.clear();
};

type ChildProps = { label?: string };

@component()
export class OnMutationStateApp extends Component {
    public mutations = 0;

    @state()
    state = { label: 'A', tick: 0 };

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`<p>${this.state.label}</p>`;
}

@component()
export class OnMutationChild extends Component<ChildProps> {
    public mutations = 0;

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template =>
        html`<span class="child">${this.props.label}</span>`;
}

@component()
export class OnMutationPropParent extends Component {
    public mutations = 0;

    @state()
    state = { label: 'first' };

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <h1>Static</h1>
        <on-mutation-child :label=${this.state.label}></on-mutation-child>
    `;
}

@component()
export class OnMutationSignalApp extends Component {
    public mutations = 0;

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`<p>${mutationSignal.value.label}</p>`;
}

@component()
export class OnMutationListApp extends Component {
    public mutations = 0;

    @state()
    state = {
        items: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
        ],
    };

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <ul>
            ${repeat(
                this.state.items,
                (item) => html`<li>${item.text}</li>`,
                (item) => item.id,
            )}
        </ul>
    `;
}

@component()
export class OnMutationSwapApp extends Component {
    public mutations = 0;

    @state()
    state = { show: 'a' as 'a' | 'b' };

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <div>
            ${
                this.state.show === 'a'
                    ? html`<span class="a">first</span>`
                    : html`<section class="b">second</section>`
            }
        </div>
    `;
}

@component()
export class OnMutationClassApp extends Component {
    public mutations = 0;

    @state()
    state = { active: false };

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <div .class=${{ box: true, active: this.state.active }}></div>
    `;
}
