import { expect, test, describe, beforeEach } from 'vitest';
import { Component, defineComponent } from '../src/component/Component';
import { html, type Template } from '../src/types';
import { state } from '../src/State';
import { present } from '../testing';
import { render } from '../utilities';

class StateFnApp extends Component {
    count = state<{ value: number }>({ value: 0 });
    label = state<{ text: string }>({ text: 'hi' });

    template = (): Template =>
        html`<p class="out">${this.label.text}:${this.count.value}</p>`;
}

defineComponent('state-fn-app', StateFnApp);

const out = (app: StateFnApp): string | null | undefined =>
    app.shadowRoot?.querySelector('.out')?.textContent;

describe('state() — component-local reactive state', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('renders initial state', async () => {
        const presenter = present().screen(html`<state-fn-app></state-fn-app>`);
        await render();
        expect(out(presenter.root<StateFnApp>())).toBe('hi:0');
    });

    test('re-renders when a state field is mutated', async () => {
        const presenter = present().screen(html`<state-fn-app></state-fn-app>`);
        await render();
        const app = presenter.root<StateFnApp>();

        app.count.value++;
        await render();
        expect(out(app)).toBe('hi:1');
    });

    test('multiple independent state fields each drive updates', async () => {
        const presenter = present().screen(html`<state-fn-app></state-fn-app>`);
        await render();
        const app = presenter.root<StateFnApp>();

        app.count.value = 5;
        app.label.text = 'bye';
        await render();
        expect(out(app)).toBe('bye:5');
    });
});
