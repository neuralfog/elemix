import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { state } from '../../src/State';
import { signal } from '../../src/Signal';
import { repeat } from '../../directives';

export const mutationSignal = signal({ label: 'initial' });

export const resetMutationSignal = (): void => {
    mutationSignal.value.label = 'initial';
    mutationSignal.subscribers.clear();
};

type ChildProps = { label?: string };

export class OnMutationStateApp extends Component {
    public mutations = 0;

    state = state({ label: 'A', tick: 0 });

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`<p>${this.state.label}</p>`;
}

defineComponent('on-mutation-state-app', OnMutationStateApp);

export class OnMutationChild extends Component<ChildProps> {
    public mutations = 0;

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template =>
        html`<span class="child">${this.props.label}</span>`;
}

defineComponent('on-mutation-child', OnMutationChild);

export class OnMutationPropParent extends Component {
    public mutations = 0;

    state = state({ label: 'first' });

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <h1>Static</h1>
        <on-mutation-child :label=${this.state.label}></on-mutation-child>
    `;
}

defineComponent('on-mutation-prop-parent', OnMutationPropParent);

export class OnMutationSignalApp extends Component {
    public mutations = 0;

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`<p>${mutationSignal.value.label}</p>`;
}

defineComponent('on-mutation-signal-app', OnMutationSignalApp);

export class OnMutationListApp extends Component {
    public mutations = 0;

    state = state({
        items: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
        ],
    });

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

defineComponent('on-mutation-list-app', OnMutationListApp);

export class OnMutationSwapApp extends Component {
    public mutations = 0;

    state = state({ show: 'a' as 'a' | 'b' });

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

defineComponent('on-mutation-swap-app', OnMutationSwapApp);

export class OnMutationClassApp extends Component {
    public mutations = 0;

    state = state({ active: false });

    onMutation(): void {
        this.mutations++;
    }

    template = (): Template => html`
        <div .class=${{ box: true, active: this.state.active }}></div>
    `;
}

defineComponent('on-mutation-class-app', OnMutationClassApp);
