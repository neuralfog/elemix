import { expect, test, describe, beforeEach, vi } from 'vitest';
import { Component } from '../src/component/Component';
import { component } from '../src/decorators/component';
import { state } from '../src/decorators/state';
import { html, type Template } from '../src/types';
import { present } from '../testing';
import { render } from '../utilities';

describe('beforeRender mutating @state', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('mutation in beforeRender is visible to template in the same render', async () => {
        @component()
        class DerivedState extends Component {
            @state()
            state = { input: 5, doubled: 0 };

            beforeRender(): void {
                this.state.doubled = this.state.input * 2;
            }

            template = (): Template => html`
                <span class="value">${this.state.doubled}</span>
            `;
        }
        void DerivedState;

        const presenter = present().screen(
            html`<derived-state></derived-state>`,
        );
        await render();
        const el = presenter.root<DerivedState>();
        expect(el.root?.querySelector('.value')?.textContent).toBe('10');
    });

    test('beforeRender state mutation: 3 template() calls, 1 real render per cycle', async () => {
        @component()
        class CountedMutation extends Component {
            @state()
            state = { counter: 0, mirror: -1 };

            public templateCalls = 0;
            public realRenderCalls = 0;

            beforeRender(): void {
                // Mutation inside beforeRender — triggers an extra schedule()
                // (locked so no new setTimeout), bumping template call count
                this.state.mirror = this.state.counter;
            }

            template = (): Template => {
                this.templateCalls++;
                return html`<span class="m">${this.state.mirror}</span>`;
            };

            onRender(): void {
                // onRender fires once per actual render() call inside the
                // setTimeout — counts real renders, not schedule dry evals
                this.realRenderCalls++;
            }
        }
        void CountedMutation;

        const presenter = present().screen(
            html`<counted-mutation></counted-mutation>`,
        );
        await render();
        const el = presenter.root<CountedMutation>();

        // Per cycle when beforeRender mutates state:
        //  - schedule() called 2x → 2 dry template() evals
        //    (1 initial + 1 from beforeRender's mutation while locked)
        //  - render() called 1x → 1 real template() call, 1 onRender
        expect(el.templateCalls).toBe(3);
        expect(el.realRenderCalls).toBe(1);
        expect(el.root?.querySelector('.m')?.textContent).toBe('0');

        // Externally trigger another cycle — exact same 3:1 ratio repeats
        el.state.counter = 7;
        await render();
        expect(el.templateCalls).toBe(6);
        expect(el.realRenderCalls).toBe(2);
        expect(el.root?.querySelector('.m')?.textContent).toBe('7');
    });

    test('beforeRender without mutation: 2 template() calls, 1 real render per cycle', async () => {
        @component()
        class PureBeforeRender extends Component {
            @state()
            state = { v: 0 };

            public templateCalls = 0;
            public realRenderCalls = 0;

            beforeRender(): void {
                // No state mutation — no extra schedule() invocation
            }

            template = (): Template => {
                this.templateCalls++;
                return html`<span class="v">${this.state.v}</span>`;
            };

            onRender(): void {
                this.realRenderCalls++;
            }
        }
        void PureBeforeRender;

        const presenter = present().screen(
            html`<pure-before-render></pure-before-render>`,
        );
        await render();
        const el = presenter.root<PureBeforeRender>();

        // Per cycle when beforeRender does NOT mutate state:
        //  - schedule() called 1x → 1 dry template() eval
        //  - render() called 1x → 1 real template() call, 1 onRender
        expect(el.templateCalls).toBe(2);
        expect(el.realRenderCalls).toBe(1);

        el.state.v = 5;
        await render();
        expect(el.templateCalls).toBe(4);
        expect(el.realRenderCalls).toBe(2);
        expect(el.root?.querySelector('.v')?.textContent).toBe('5');
    });

    test('beforeRender fires before template on every render', async () => {
        const order: string[] = [];

        @component()
        class OrderedRender extends Component {
            @state()
            state = { tick: 0 };

            beforeRender(): void {
                order.push(`before:${this.state.tick}`);
            }

            template = (): Template => {
                order.push(`template:${this.state.tick}`);
                return html`<span>${this.state.tick}</span>`;
            };

            onRender(): void {
                order.push(`onRender:${this.state.tick}`);
            }
        }
        void OrderedRender;

        const presenter = present().screen(
            html`<ordered-render></ordered-render>`,
        );
        await render();
        const el = presenter.root<OrderedRender>();

        // schedule() runs a dry template() before the actual render. The
        // real render order is beforeRender → template → onRender, so check
        // the LAST template call (the real one) is after beforeRender.
        const mountIdx = order.indexOf('before:0');
        const tplIdx = order.lastIndexOf('template:0');
        const onIdx = order.indexOf('onRender:0');
        expect(mountIdx).toBeGreaterThanOrEqual(0);
        expect(tplIdx).toBeGreaterThan(mountIdx);
        expect(onIdx).toBeGreaterThan(tplIdx);

        order.length = 0;
        el.state.tick = 1;
        await render();
        const m2 = order.indexOf('before:1');
        const t2 = order.lastIndexOf('template:1');
        const o2 = order.indexOf('onRender:1');
        expect(m2).toBeGreaterThanOrEqual(0);
        expect(t2).toBeGreaterThan(m2);
        expect(o2).toBeGreaterThan(t2);
    });

    test('mutating state in beforeRender on a subsequent render still lands in current template', async () => {
        @component()
        class LiveDerived extends Component {
            @state()
            state = { input: 1, derived: 0 };

            beforeRender(): void {
                this.state.derived = this.state.input + 100;
            }

            template = (): Template => html`
                <span class="d">${this.state.derived}</span>
            `;
        }
        void LiveDerived;

        const presenter = present().screen(
            html`<live-derived></live-derived>`,
        );
        await render();
        const el = presenter.root<LiveDerived>();
        expect(el.root?.querySelector('.d')?.textContent).toBe('101');

        el.state.input = 42;
        await render();
        expect(el.root?.querySelector('.d')?.textContent).toBe('142');
    });

    test('spy verifies beforeRender called with renderTriggers argument', async () => {
        @component()
        class TriggerSpy extends Component {
            @state()
            state = { v: 0 };

            beforeRender(_triggers?: string[]): void {}

            template = (): Template =>
                html`<span>${this.state.v}</span>`;
        }
        void TriggerSpy;

        const presenter = present().screen(
            html`<trigger-spy></trigger-spy>`,
        );
        const el = presenter.root<TriggerSpy>();
        const spy = vi.spyOn(el, 'beforeRender');

        await render();
        expect(spy).toHaveBeenCalled();
        const args = spy.mock.calls[0][0];
        expect(Array.isArray(args)).toBe(true);
    });
});
