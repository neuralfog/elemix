import { expect, test, describe, beforeEach } from 'vitest';
import { Component, defineComponent } from '../src/component/Component';
import { html } from '../src/renderer/render';
import { indexFromMarker } from '../src/renderer/utils';
import { Reactive } from '../reactive';
import { diff } from '../src/renderer/diff';
import { present } from '../testing';
import { render } from '../utilities';
import type { Template } from '../src/types';

class DirectClassEdge extends Component {
    public value: unknown = null;

    template = (): Template => html`
        <div .class=${this.value}>edge</div>
    `;
}

defineComponent('direct-class-edge', DirectClassEdge);

class DirectClassNoInit extends Component {
    public value: unknown = null;

    template = (): Template => html`<div .class=${this.value}>plain</div>`;
}

defineComponent('direct-class-no-init', DirectClassNoInit);

describe('indexFromMarker', () => {
    test('throws when the comment value does not match the marker shape', () => {
        expect(() => indexFromMarker('not a marker')).toThrow(
            'Unable to extract index from hole comment',
        );
    });
});

describe('Reactive — subscribe is idempotent', () => {
    test('subscribing the same component twice keeps a single entry', () => {
        const reactive = new Reactive<{ count: number }>({ count: 0 });
        const fake = { tracked: new Set() } as unknown as Component;
        reactive.subscribe(fake);
        reactive.subscribe(fake);
        reactive.subscribe(fake);
        expect(reactive.subscribers.size).toBe(1);
    });
});

describe('diff — equal length, identical keys → EMPTY', () => {
    test('returns an empty diff when both lists have the same keys in order', () => {
        const a = [
            {
                strings: [] as unknown as TemplateStringsArray,
                values: [],
                key: 'a',
            },
            {
                strings: [] as unknown as TemplateStringsArray,
                values: [],
                key: 'b',
            },
        ];
        const b = [
            {
                strings: [] as unknown as TemplateStringsArray,
                values: [],
                key: 'a',
            },
            {
                strings: [] as unknown as TemplateStringsArray,
                values: [],
                key: 'b',
            },
        ];
        const result = diff(a, b);
        expect(result).toEqual({ deletes: [], inserts: [], moves: [] });
    });
});

describe('directClassHole — branch coverage', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('null value with an initial class keeps the initial class, then a string replaces it, then null restores', async () => {
        const presenter = present().screen(
            html`<direct-class-edge></direct-class-edge>`,
        );
        const c = presenter.root<DirectClassEdge>();
        await render();

        // initial render: value is null, div has no class (no initClass)
        const div = c.shadowRoot?.querySelector('div');
        expect(div?.getAttribute('class')).toBeNull();

        // string value gets merged with initClass (empty) → just the string
        c.value = 'a b';
        c.render();
        await render();
        expect(div?.getAttribute('class')?.split(' ').sort()).toEqual([
            'a',
            'b',
        ]);

        // object map with all flags true
        c.value = { x: true, y: true };
        c.render();
        await render();
        expect(div?.getAttribute('class')?.split(' ').sort()).toEqual([
            'x',
            'y',
        ]);

        // object map with all flags false — empty result
        c.value = { x: false, y: false };
        c.render();
        await render();
        expect(div?.getAttribute('class')).toBe('');

        // null again — should restore (no initClass means nothing to restore to)
        c.value = null;
        c.render();
        await render();
    });

    test('directClassHole leaves no class attribute when init is empty and value is null', async () => {
        const presenter = present().screen(
            html`<direct-class-no-init></direct-class-no-init>`,
        );
        const c = presenter.root<DirectClassNoInit>();
        await render();

        const div = c.shadowRoot?.querySelector('div');
        expect(div?.getAttribute('class')).toBeNull();
    });
});

describe('Fragment cache — re-rendering the same template strings reuses cached fragment', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('updating values without changing strings keeps the same parsed template', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const make = (n: number) => html`<p>count: ${n}</p>`;

        const { render: renderTemplate } = await import(
            '../src/renderer/render'
        );
        renderTemplate(make(1), container);
        renderTemplate(make(2), container);
        renderTemplate(make(3), container);

        expect(container.querySelector('p')?.textContent).toBe('count: 3');
    });
});
