import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';
import {
    mutationSignal,
    resetMutationSignal,
    type OnMutationChild,
    type OnMutationClassApp,
    type OnMutationListApp,
    type OnMutationPropParent,
    type OnMutationSignalApp,
    type OnMutationStateApp,
    type OnMutationSwapApp,
} from './fixtures/OnMutation';
import './fixtures/OnMutation';

describe('onMutation lifecycle hook', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetMutationSignal();
    });

    describe('local state', () => {
        test('fires on initial mount (first paint is a mutation)', async () => {
            const presenter = present().screen(
                html`<on-mutation-state-app></on-mutation-state-app>`,
            );
            await render();

            const app = presenter.root<OnMutationStateApp>();
            expect(app.mutations).toBe(1);
        });

        test('fires when state change produces a DOM mutation', async () => {
            const presenter = present().screen(
                html`<on-mutation-state-app></on-mutation-state-app>`,
            );
            await render();
            const app = presenter.root<OnMutationStateApp>();

            app.state.label = 'B';
            await render();

            expect(app.mutations).toBe(2);
        });

        test('does NOT fire when state set to same value (no DOM mutation)', async () => {
            const presenter = present().screen(
                html`<on-mutation-state-app></on-mutation-state-app>`,
            );
            await render();
            const app = presenter.root<OnMutationStateApp>();

            const before = app.mutations;
            app.state.label = 'A';
            await render();

            expect(app.mutations).toBe(before);
        });

        test('does NOT fire when state change is not consumed in template', async () => {
            const presenter = present().screen(
                html`<on-mutation-state-app></on-mutation-state-app>`,
            );
            await render();
            const app = presenter.root<OnMutationStateApp>();

            const before = app.mutations;
            app.state.tick = 42;
            await render();

            expect(app.mutations).toBe(before);
        });
    });

    describe('props on nested component', () => {
        test('child onMutation fires when its bound prop changes', async () => {
            const presenter = present().screen(
                html`<on-mutation-prop-parent></on-mutation-prop-parent>`,
            );
            await render();

            const child =
                presenter.getComponent<OnMutationChild>('on-mutation-child');
            const before = child.mutations;

            const parent = presenter.root<OnMutationPropParent>();
            parent.state.label = 'second';
            await render();

            expect(child.mutations).toBe(before + 1);
        });

        test('parent onMutation does NOT fire when only a child prop write happened', async () => {
            const presenter = present().screen(
                html`<on-mutation-prop-parent></on-mutation-prop-parent>`,
            );
            await render();
            const parent = presenter.root<OnMutationPropParent>();

            const before = parent.mutations;
            parent.state.label = 'second';
            await render();

            expect(parent.mutations).toBe(before);
        });
    });

    describe('signals', () => {
        test('fires when consumed signal value changes', async () => {
            const presenter = present().screen(
                html`<on-mutation-signal-app></on-mutation-signal-app>`,
            );
            await render();
            const app = presenter.root<OnMutationSignalApp>();

            const before = app.mutations;
            mutationSignal.value.label = 'updated';
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('does NOT fire when signal set to same value', async () => {
            const presenter = present().screen(
                html`<on-mutation-signal-app></on-mutation-signal-app>`,
            );
            await render();
            const app = presenter.root<OnMutationSignalApp>();

            const before = app.mutations;
            mutationSignal.value.label = 'initial';
            await render();

            expect(app.mutations).toBe(before);
        });
    });

    describe('list operations', () => {
        test('fires on insert', async () => {
            const presenter = present().screen(
                html`<on-mutation-list-app></on-mutation-list-app>`,
            );
            await render();
            const app = presenter.root<OnMutationListApp>();

            const before = app.mutations;
            app.state.items.push({ id: 'd', text: 'D' });
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('fires on delete', async () => {
            const presenter = present().screen(
                html`<on-mutation-list-app></on-mutation-list-app>`,
            );
            await render();
            const app = presenter.root<OnMutationListApp>();

            const before = app.mutations;
            app.state.items.splice(0, 1);
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('fires on reorder (move-only, same content)', async () => {
            const presenter = present().screen(
                html`<on-mutation-list-app></on-mutation-list-app>`,
            );
            await render();
            const app = presenter.root<OnMutationListApp>();

            const before = app.mutations;
            const reversed = [...app.state.items].reverse();
            app.state.items.splice(0, app.state.items.length, ...reversed);
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('does NOT fire when reassigning the same items array contents', async () => {
            const presenter = present().screen(
                html`<on-mutation-list-app></on-mutation-list-app>`,
            );
            await render();
            const app = presenter.root<OnMutationListApp>();

            const before = app.mutations;
            const same = app.state.items.map((i) => ({ ...i }));
            app.state.items.splice(0, app.state.items.length, ...same);
            await render();

            expect(app.mutations).toBe(before);
        });
    });

    describe('conditional template swap', () => {
        test('fires when template strings change', async () => {
            const presenter = present().screen(
                html`<on-mutation-swap-app></on-mutation-swap-app>`,
            );
            await render();
            const app = presenter.root<OnMutationSwapApp>();

            const before = app.mutations;
            app.state.show = 'b';
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('does NOT fire when conditional resolves to same branch', async () => {
            const presenter = present().screen(
                html`<on-mutation-swap-app></on-mutation-swap-app>`,
            );
            await render();
            const app = presenter.root<OnMutationSwapApp>();

            const before = app.mutations;
            app.state.show = 'a';
            await render();

            expect(app.mutations).toBe(before);
        });
    });

    describe('.class={{...}} binding', () => {
        test('fires when class map flips a flag', async () => {
            const presenter = present().screen(
                html`<on-mutation-class-app></on-mutation-class-app>`,
            );
            await render();
            const app = presenter.root<OnMutationClassApp>();

            const before = app.mutations;
            app.state.active = true;
            await render();

            expect(app.mutations).toBe(before + 1);
        });

        test('does NOT fire when class map result is identical', async () => {
            const presenter = present().screen(
                html`<on-mutation-class-app></on-mutation-class-app>`,
            );
            await render();
            const app = presenter.root<OnMutationClassApp>();

            const before = app.mutations;
            app.state.active = false;
            await render();

            expect(app.mutations).toBe(before);
        });
    });
});
