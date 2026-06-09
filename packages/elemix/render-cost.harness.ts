/**
 * Render-cost harness. Runs in isolation via its own vitest config:
 *   pnpm render-cost
 * Mounts real reactive Components, drives every mutation through reactive state
 * (cmp.state.data.push/splice/…), and reports per operation the O(n) bookkeeping
 * (row templates rebuilt, hole reads) vs the O(changed) DOM mutations. Two passes:
 * plain repeat vs memoized repeat.
 */
import { expect, test } from 'vitest';
import { Component, defineComponent } from './src/component/Component';
import { html } from './src/renderer/render';
import { state } from './src/State';
import { repeat } from './src/renderer/directives';
import { render as flush } from './src/utilities';
import { diff } from './src/renderer/diff';
import type { HtmlTemplate } from './src/renderer/types';

test('diff cost', () => {
    const make = (keys: string[]): HtmlTemplate[] =>
        keys.map((k) => ({ strings: [] as unknown as TemplateStringsArray, values: [], key: k }));
    const keys = Array.from({ length: 1000 }, (_, i) => String(i));
    const old = make(keys);
    const swapped = keys.slice();
    const t = swapped[1];
    swapped[1] = swapped[998];
    swapped[998] = t;
    const next = make(swapped);

    const N = 10000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) diff(old, next);
    const t1 = performance.now();
    const usPerCall = ((t1 - t0) / N) * 1000;
    console.log(`\ndiff() of a 1000-row swap: ${usPerCall.toFixed(2)} µs/call (one swap op runs it once)\n`);
});

type Item = { id: number; label: string; selected: boolean };

const c = { rebuilt: 0, reads: 0, textW: 0, attrW: 0, nodeOps: 0 };

let nid = 1;
const build = (n: number): Item[] =>
    Array.from({ length: n }, () => ({ id: nid++, label: `row ${nid}`, selected: false }));

const row = (item: Item) => {
    c.rebuilt++;
    return html`<tr class=${item.selected ? 'danger' : ''}><td>${item.id}</td><td><a data-id=${item.id}>${item.label}</a></td></tr>`;
};

class CostList extends Component {
    state = state<{ data: Item[] }>({ data: [] });
    template = () =>
        html`<table><tbody>${repeat(
            this.state.data,
            (item: Item) => row(item),
            (item: Item) => String(item.id),
        )}</tbody></table>`;
}

class CostListAuto extends Component {
    state = state<{ data: Item[] }>({ data: [] });
    template = () =>
        html`<table><tbody>${repeat(
            this.state.data,
            (item: Item) => row(item),
        )}</tbody></table>`;
}

defineComponent('cost-list', CostList);
defineComponent('cost-list-auto', CostListAuto);

type Result = Record<string, number | string>;

const measureComponent = async (tag: string): Promise<Result[]> => {
    document.body.innerHTML = `<${tag}></${tag}>`;
    await flush();
    const cmp = document.querySelector(tag) as unknown as CostList;

    const countNodes = (records: MutationRecord[]) => {
        for (const r of records) c.nodeOps += r.addedNodes.length + r.removedNodes.length;
    };
    const mo = new MutationObserver(countNodes);
    mo.observe(cmp.root as Node, { childList: true, subtree: true });

    const results: Result[] = [];
    const measure = async (label: string, mutate: () => void): Promise<void> => {
        c.rebuilt = c.reads = c.textW = c.attrW = c.nodeOps = 0;
        mutate();
        await flush();
        countNodes(mo.takeRecords());
        results.push({
            operation: label,
            rebuilt: c.rebuilt,
            'hole reads': c.reads,
            'text writes': c.textW,
            'attr writes': c.attrW,
            'node ops': c.nodeOps,
        });
    };

    await measure('create 1k', () => { cmp.state.data.push(...build(1000)); });
    await measure('update 10th', () => { const d = cmp.state.data; for (let i = 0; i < d.length; i += 10) d[i].label += ' !!!'; });
    await measure('select', () => { cmp.state.data[2].selected = true; });
    await measure('swap', () => { const d = cmp.state.data; const t = d[1]; d[1] = d[998]; d[998] = t; });
    await measure('remove 1', () => { cmp.state.data.splice(0, 1); });
    await measure('clear', () => { cmp.state.data.splice(0); });

    mo.disconnect();
    return results;
};

const table = (title: string, results: Result[]): string => {
    const cols = ['operation', 'rebuilt', 'hole reads', 'text writes', 'attr writes', 'node ops'];
    const width = cols.map((col) =>
        Math.max(col.length, ...results.map((r) => String(r[col]).length)),
    );
    const line = (cells: Array<string | number>) =>
        '│ ' + cells.map((cell, i) => String(cell).padEnd(width[i])).join(' │ ') + ' │';
    const sep = (l: string, m: string, r: string) =>
        l + width.map((n) => '─'.repeat(n + 2)).join(m) + r;

    return [
        title,
        sep('┌', '┬', '┐'),
        line(cols),
        sep('├', '┼', '┤'),
        ...results.map((r) => line(cols.map((col) => r[col]))),
        sep('└', '┴', '┘'),
    ].join('\n');
};

test('render cost', { timeout: 60_000 }, async () => {
    const origAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, ...a: [string, string]) {
        c.attrW++;
        return origAttr.apply(this, a);
    };
    const tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
    Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true,
        get(this: Node) { c.reads++; return tc.get!.call(this); },
        set(this: Node, v: string) { c.textW++; return tc.set!.call(this, v); },
    });

    const plain = await measureComponent('cost-list');
    const auto = await measureComponent('cost-list-auto');

    Element.prototype.setAttribute = origAttr;
    Object.defineProperty(Node.prototype, 'textContent', tc);

    const plainTable = table('repeat(list, cb, key)   — explicit key', plain);
    const autoTable = table('repeat(list, cb)         — auto identity key', auto);

    console.log(
        `\nElemix render cost — reactive 1000-row list (mutations via cmp.state.data):\n${plainTable}\n${autoTable}`,
    );

    expect(plainTable).toMatchSnapshot();
    expect(autoTable).toMatchSnapshot();
});
