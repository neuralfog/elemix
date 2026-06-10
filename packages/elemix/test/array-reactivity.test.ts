import { describe, test, expect, beforeEach } from 'vitest';
import { Component, defineComponent } from '../src/component/Component';
import { html } from '../src/renderer/render';
import { state } from '../src/State';
import { repeat } from '../src/renderer/directives';
import { render } from '../utilities';

type Item = { id: number; n: number; meta?: { tag: string } };
type S = { items: Item[] };

const mk = (id: number, n: number): Item => ({ id, n });

class ArrApp extends Component {
    state = state<S>({ items: [] });
    template = () =>
        html`<div class="len">${this.state.items.length}</div><ul>${repeat(
            this.state.items,
            (it: Item) =>
                html`<li data-id=${it.id}>${it.id}:${it.n}${it.meta ? `:${it.meta.tag}` : ''}</li>`,
            (it: Item) => String(it.id),
        )}</ul>`;
}
defineComponent('arr-app', ArrApp);

describe('array reactivity', () => {
    let cmp: ArrApp;
    const lis = () => Array.from(cmp.shadowRoot!.querySelectorAll('li'));
    const ids = () => lis().map((l) => l.getAttribute('data-id'));
    const text = () => lis().map((l) => l.textContent);
    const len = () => cmp.shadowRoot!.querySelector('.len')?.textContent;

    beforeEach(async () => {
        document.body.innerHTML = '<arr-app></arr-app>';
        await render();
        cmp = document.querySelector('arr-app') as unknown as ArrApp;
    });

    test('array reference is stable across reads', () => {
        cmp.state.items = [mk(1, 1)];
        expect(cmp.state.items).toBe(cmp.state.items);
    });

    test('index read returns the same item across reads', () => {
        cmp.state.items = [mk(1, 1)];
        expect(cmp.state.items[0]).toBe(cmp.state.items[0]);
    });

    test('length and iteration reflect contents', () => {
        cmp.state.items = [mk(1, 1), mk(2, 2), mk(3, 3)];
        expect(cmp.state.items.length).toBe(3);
        expect(cmp.state.items.map((i) => i.id)).toEqual([1, 2, 3]);
        expect(cmp.state.items.find((i) => i.n === 2)?.id).toBe(2);
    });

    test('assign whole array renders rows + length', async () => {
        cmp.state.items = [mk(1, 10), mk(2, 20), mk(3, 30)];
        await render();
        expect(text()).toEqual(['1:10', '2:20', '3:30']);
        expect(len()).toBe('3');
    });

    test('push appends and re-renders', async () => {
        cmp.state.items = [mk(1, 1)];
        await render();
        cmp.state.items.push(mk(2, 2));
        await render();
        expect(ids()).toEqual(['1', '2']);
        expect(len()).toBe('2');
    });

    test('splice removes', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2), mk(3, 3)];
        await render();
        cmp.state.items.splice(1, 1);
        await render();
        expect(ids()).toEqual(['1', '3']);
        expect(len()).toBe('2');
    });

    test('splice inserts', async () => {
        cmp.state.items = [mk(1, 1), mk(3, 3)];
        await render();
        cmp.state.items.splice(1, 0, mk(2, 2));
        await render();
        expect(ids()).toEqual(['1', '2', '3']);
    });

    test('pop / shift / unshift', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2), mk(3, 3)];
        await render();
        cmp.state.items.pop();
        await render();
        expect(ids()).toEqual(['1', '2']);
        cmp.state.items.shift();
        await render();
        expect(ids()).toEqual(['2']);
        cmp.state.items.unshift(mk(9, 9));
        await render();
        expect(ids()).toEqual(['9', '2']);
    });

    test('sort and reverse', async () => {
        cmp.state.items = [mk(1, 3), mk(2, 1), mk(3, 2)];
        await render();
        cmp.state.items.sort((a, b) => a.n - b.n);
        await render();
        expect(ids()).toEqual(['2', '3', '1']);
        cmp.state.items.reverse();
        await render();
        expect(ids()).toEqual(['1', '3', '2']);
    });

    test('index assignment replaces an item', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2)];
        await render();
        cmp.state.items[1] = mk(9, 99);
        await render();
        expect(text()).toEqual(['1:1', '9:99']);
    });

    test('swap via index assignment moves rows', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2), mk(3, 3)];
        await render();
        const d = cmp.state.items;
        const tmp = d[0];
        d[0] = d[2];
        d[2] = tmp;
        await render();
        expect(ids()).toEqual(['3', '2', '1']);
    });

    test('mutating an existing item field updates its row', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2)];
        await render();
        cmp.state.items[0].n = 100;
        await render();
        expect(text()).toEqual(['1:100', '2:2']);
    });

    test('pushed item is reactive', async () => {
        cmp.state.items = [mk(1, 1)];
        await render();
        cmp.state.items.push(mk(2, 2));
        await render();
        cmp.state.items[1].n = 50;
        await render();
        expect(text()).toEqual(['1:1', '2:50']);
    });

    test('spliced-in item is reactive', async () => {
        cmp.state.items = [mk(1, 1)];
        await render();
        cmp.state.items.splice(1, 0, mk(2, 2));
        await render();
        cmp.state.items[1].n = 77;
        await render();
        expect(text()).toEqual(['1:1', '2:77']);
    });

    test('index-assigned item is reactive', async () => {
        cmp.state.items = [mk(1, 1), mk(2, 2)];
        await render();
        cmp.state.items[1] = mk(9, 9);
        await render();
        cmp.state.items[1].n = 88;
        await render();
        expect(text()).toEqual(['1:1', '9:88']);
    });

    test('unshifted item is reactive', async () => {
        cmp.state.items = [mk(1, 1)];
        await render();
        cmp.state.items.unshift(mk(2, 2));
        await render();
        cmp.state.items[0].n = 22;
        await render();
        expect(text()).toEqual(['2:22', '1:1']);
    });

    test('nested object on a new item is reactive', async () => {
        const withMeta: Item = { id: 1, n: 1, meta: { tag: 'a' } };
        cmp.state.items = [withMeta];
        await render();
        expect(text()).toEqual(['1:1:a']);
        cmp.state.items[0].meta!.tag = 'b';
        await render();
        expect(text()).toEqual(['1:1:b']);
    });
});
