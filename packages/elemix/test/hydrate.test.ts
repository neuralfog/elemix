import { describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import {
    $__clone,
    $__event,
    $__setText,
    $__template,
} from '../src/runtime/dom';
import { $__dynLens, $__splitRun } from '../src/runtime/hydrate';
import { $__effect } from '../src/runtime/reactive';
import { $__state } from '../src/runtime/state';

// Hand-written to match the compiler's --hydrate output for a CounterApp:
//   template = tpl`<button>count is ${this.state.count}</button>` + @click
// so this exercises the runtime hydration path (constructor DSD-adopt guard,
// connectedCallback hydrate branch, markerless $__dynLens/$__splitRun, reactive
// text, event) against a simulated server render, without shelling out to the
// compiler.
const _t0 = $__template('<button>count is <!----></button>');

class CounterApp extends Component {
    static $$__sheets = [];
    state = $__state<{ count: number }>({ count: 0 });

    increment = (): void => {
        this.state.count++;
    };

    $$__view(): DocumentFragment {
        const _r0 = $__clone(_t0);
        const _n1 = _r0.firstChild as Node;
        const _n2 = _n1.firstChild?.nextSibling as ChildNode;
        $__event(_n1, 'click', this.increment);
        const _x3 = document.createTextNode('');
        _n2.replaceWith(_x3);
        $__effect(() => {
            $__setText(_x3, this.state.count);
        });
        return _r0;
    }

    $$__hydrate(root: Node): void {
        const _n0 = root.firstChild as Element;
        const _d = $__dynLens(_n0);
        const _v = $__splitRun(_n0.firstChild as Text, [9], _d);
        $__event(_n0, 'click', this.increment);
        $__effect(() => {
            $__setText(_v[0], this.state.count);
        });
    }
}

// The markerless shadow markup the SSR emit produces (minus the DSD <template>
// wrapper the browser turns into this shadow root): the SSR inline style plus the
// button carrying `data-t` (the rendered length of the dynamic count) and clean,
// comment-free text.
const serverShadow =
    '<style data-ssr>button{color:red}</style>' +
    '<button data-t="1">count is 0</button>';

describe('hydration', () => {
    test('adopts the server shadow and becomes reactive without rebuilding', () => {
        // Simulate a declaratively-shadowed, server-rendered element: the shadow
        // root exists and is populated BEFORE the component is defined/upgraded.
        const host = document.createElement('counter-app-h') as CounterApp;
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = serverShadow;
        document.body.appendChild(host);
        customElements.define('counter-app-h', CounterApp);

        const button = host.shadowRoot?.querySelector('button');
        expect(button).not.toBeNull();
        // Exactly one button: hydration reused the server node, did not append a
        // second freshly-rendered one.
        expect(host.shadowRoot?.querySelectorAll('button').length).toBe(1);
        // The SSR-only inline style is stripped (adoptedStyleSheets replaces it).
        expect(host.shadowRoot?.querySelector('style[data-ssr]')).toBeNull();
        // No comment markers survive, and `data-t` is stripped on hydration.
        expect(button?.getAttribute('data-t')).toBeNull();
        expect(
            [...(button?.childNodes ?? [])].filter((n) => n.nodeType === 8)
                .length,
        ).toBe(0);
        expect(button?.textContent).toBe('count is 0');

        button?.dispatchEvent(new Event('click'));
        expect(button?.textContent).toBe('count is 1');

        button?.dispatchEvent(new Event('click'));
        expect(button?.textContent).toBe('count is 2');
    });
});
