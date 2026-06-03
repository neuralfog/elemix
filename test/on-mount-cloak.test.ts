import { expect, test, describe, beforeEach } from 'vitest';
import { Component } from '../src/component/Component';
import { component } from '../src/decorators/component';
import { state } from '../src/decorators/state';
import { html, type Template } from '../src/types';
import { ref, type Ref } from '../src/utilities';
import { present } from '../testing';
import { render } from '../utilities';

const onMountCounts = new Map<string, number>();
const beforeMountCounts = new Map<string, number>();

const counter = (key: string, m: Map<string, number>) => {
    m.set(key, (m.get(key) ?? 0) + 1);
};

@component()
class PlainChild extends Component {
    onMount(): void {
        counter('plain-child', onMountCounts);
    }
    template = (): Template => html`<span>plain</span>`;
}

@component()
class StateMutatingChild extends Component {
    @state()
    state = { ready: false };

    beforeMount(): void {
        counter('state-mutating-child', beforeMountCounts);
        // Mutating reactive state during beforeMount used to lock the renderer
        // early; the connectedCallback's render(ON_MOUNT, true) then bailed
        // and data-cloak was never removed.
        this.state.ready = true;
    }

    onMount(): void {
        counter('state-mutating-child', onMountCounts);
    }

    template = (): Template => html`
        <span class=${this.state.ready ? 'ready' : 'pending'}
            >${this.state.ready ? 'READY' : 'PENDING'}</span
        >
    `;
}

@component()
class PropConsumerChild extends Component<{ model: Ref<{ count: number }> }> {
    @state()
    state = { internal: 0 };

    beforeMount(): void {
        counter('prop-consumer-child', beforeMountCounts);
        // Read prop + write state — exercises the prop-bound + state-mutate path.
        this.state.internal = this.props.model.value.count + 100;
    }

    onMount(): void {
        counter('prop-consumer-child', onMountCounts);
    }

    template = (): Template => html`
        <span class="value">${this.state.internal}</span>
    `;
}

@component()
class PropConsumerParent extends Component {
    @state()
    state = { canvas: ref({ count: 5 }) };

    template = (): Template => html`
        <prop-consumer-child
            :model=${this.state.canvas}
        ></prop-consumer-child>
    `;
}

@component()
class SwapParent extends Component {
    @state()
    state = { loaded: false };

    template = (): Template =>
        this.state.loaded
            ? html`<state-mutating-child></state-mutating-child>`
            : html`<div class="loader">loading</div>`;
}

describe('onMount + data-cloak across schedule paths', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        onMountCounts.clear();
        beforeMountCounts.clear();
    });

    test('plain mount — data-cloak removed, onMount fires once', async () => {
        const presenter = present().screen(html`<plain-child></plain-child>`);
        await render();
        const el = presenter.root<PlainChild>();
        expect(el.hasAttribute('data-cloak')).toBe(false);
        expect(onMountCounts.get('plain-child')).toBe(1);
    });

    test('state mutation in beforeMount — data-cloak still removed', async () => {
        const presenter = present().screen(
            html`<state-mutating-child></state-mutating-child>`,
        );
        await render();
        const el = presenter.root<StateMutatingChild>();
        expect(el.hasAttribute('data-cloak')).toBe(false);
        expect(beforeMountCounts.get('state-mutating-child')).toBe(1);
        expect(onMountCounts.get('state-mutating-child')).toBe(1);
        expect(el.root?.querySelector('.ready')?.textContent).toBe('READY');
    });

    test('child receives bound :model and mutates state — cloak removed', async () => {
        const presenter = present().screen(
            html`<prop-consumer-parent></prop-consumer-parent>`,
        );
        await render();
        const parent = presenter.root<PropConsumerParent>();
        const child = parent.shadowRoot?.querySelector(
            'prop-consumer-child',
        ) as PropConsumerChild | null;
        expect(child).toBeTruthy();
        expect(child?.hasAttribute('data-cloak')).toBe(false);
        expect(onMountCounts.get('prop-consumer-child')).toBe(1);
        expect(child?.root?.querySelector('.value')?.textContent).toBe('105');
    });

    test('parent removes cloak too', async () => {
        const presenter = present().screen(
            html`<prop-consumer-parent></prop-consumer-parent>`,
        );
        await render();
        const parent = presenter.root<PropConsumerParent>();
        expect(parent.hasAttribute('data-cloak')).toBe(false);
    });

    test('conditional swap (loader → child with state-mutating beforeMount) — cloak removed on the new child', async () => {
        const presenter = present().screen(html`<swap-parent></swap-parent>`);
        await render();
        const parent = presenter.root<SwapParent>();
        parent.state.loaded = true;
        await render();
        const child = parent.shadowRoot?.querySelector(
            'state-mutating-child',
        ) as StateMutatingChild | null;
        expect(child).toBeTruthy();
        expect(child?.hasAttribute('data-cloak')).toBe(false);
        expect(onMountCounts.get('state-mutating-child')).toBe(1);
    });

    test('onMount fires exactly once even when beforeMount triggers extra schedules', async () => {
        const presenter = present().screen(
            html`<state-mutating-child></state-mutating-child>`,
        );
        await render();
        // Subsequent updates should not re-fire onMount.
        const el = presenter.root<StateMutatingChild>();
        el.state.ready = false;
        await render();
        el.state.ready = true;
        await render();
        expect(onMountCounts.get('state-mutating-child')).toBe(1);
    });
});
