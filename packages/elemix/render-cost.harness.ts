/**
 * Render-cost harness (compile-only runtime). Runs in isolation via:
 *   pnpm render-cost
 * Mounts a real compiled-style Component — a hand-written view() using the very
 * primitives the compiler emits (template/clone/_list/_text/_class/_attr) — and
 * drives every mutation through reactive state (cmp.state.data.push/splice/…).
 * It reports, per operation, the work the fine-grained runtime actually does:
 * row builders invoked, text/attr writes, and DOM node ops. The story is that
 * update/select/swap are O(changed) — zero row rebuilds, no hole re-reads — while
 * only create/clear are O(n). There is no interpreter, so nothing re-reads the DOM.
 */
import { test } from 'vitest';
import { Component, defineComponent } from './src/component/Component';
import { _attr, _class, _list, _text, clone, template } from './src/runtime';
import { state } from './src/runtime/state';

type Item = { id: number; label: string; selected: boolean };

const c = { rebuilt: 0, textW: 0, attrW: 0, nodeOps: 0 };

let nid = 1;
const build = (n: number): Item[] =>
    Array.from({ length: n }, () => ({
        id: nid++,
        label: `row ${nid}`,
        selected: false,
    }));

// One compiled-style row: <tr class><td>{id}</td><td><a data-id>{label}</a></td>
const rowTpl = template('<tr><td></td><td><a></a></td></tr>');
const buildRow = (item: Item): HTMLElement => {
    c.rebuilt++;
    const root = clone(rowTpl);
    const tr = root.firstChild as HTMLElement;
    const td0 = tr.firstChild as HTMLElement;
    const a = (tr.children[1] as HTMLElement).firstChild as HTMLElement;
    const idText = td0.appendChild(document.createTextNode(''));
    const labelText = a.appendChild(document.createTextNode(''));
    _class(tr, () => (item.selected ? 'danger' : ''));
    _text(idText, () => item.id);
    _attr(a, 'data-id', () => item.id);
    _text(labelText, () => item.label);
    return tr;
};

const listTpl = template('<table><tbody><!----></tbody></table>');
class CostList extends Component {
    state = state<{ data: Item[] }>({ data: [] });
    view(): DocumentFragment {
        const root = clone(listTpl);
        const tbody = (root.firstChild as HTMLElement)
            .firstChild as HTMLElement;
        const anchor = tbody.firstChild as Node; // the <!----> list anchor
        _list(
            anchor,
            () => this.state.data,
            (item) => String(item.id),
            buildRow,
        );
        return root;
    }
}
defineComponent('cost-list', CostList);

type Result = Record<string, number | string>;

const measureComponent = (tag: string): Result[] => {
    document.body.innerHTML = `<${tag}></${tag}>`;
    const cmp = document.querySelector(tag) as unknown as CostList;

    const countNodes = (records: MutationRecord[]) => {
        for (const r of records)
            c.nodeOps += r.addedNodes.length + r.removedNodes.length;
    };
    const mo = new MutationObserver(countNodes);
    mo.observe(cmp.root as Node, { childList: true, subtree: true });

    const results: Result[] = [];
    const measure = (label: string, mutate: () => void): void => {
        c.rebuilt = c.textW = c.attrW = c.nodeOps = 0;
        mutate(); // reactive effects re-run synchronously
        countNodes(mo.takeRecords());
        results.push({
            operation: label,
            rebuilt: c.rebuilt,
            'text writes': c.textW,
            'attr writes': c.attrW,
            'node ops': c.nodeOps,
        });
    };

    measure('create 1k', () => {
        cmp.state.data.push(...build(1000));
    });
    measure('update 10th', () => {
        const d = cmp.state.data;
        for (let i = 0; i < d.length; i += 10) d[i].label += ' !!!';
    });
    measure('select', () => {
        cmp.state.data[2].selected = true;
    });
    measure('swap', () => {
        // index assignment is NOT reactive — swap via an array reassign, exactly
        // as the compiler lowers it; _list reconciles to minimal (LIS) moves.
        const d = cmp.state.data.slice();
        const t = d[1];
        d[1] = d[998];
        d[998] = t;
        cmp.state.data = d;
    });
    measure('remove 1', () => {
        cmp.state.data.splice(0, 1);
    });
    measure('clear', () => {
        cmp.state.data.splice(0);
    });

    mo.disconnect();
    return results;
};

const table = (title: string, results: Result[]): string => {
    const cols = [
        'operation',
        'rebuilt',
        'text writes',
        'attr writes',
        'node ops',
    ];
    const width = cols.map((col) =>
        Math.max(col.length, ...results.map((r) => String(r[col]).length)),
    );
    const line = (cells: Array<string | number>) =>
        `│ ${cells.map((cell, i) => String(cell).padEnd(width[i])).join(' │ ')} │`;
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

test('render cost', { timeout: 60_000 }, ({ expect }) => {
    const origAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (
        this: Element,
        ...a: [string, string]
    ) {
        c.attrW++;
        return origAttr.apply(this, a);
    };
    // _text writes through CharacterData.data (not textContent).
    const dataDesc = Object.getOwnPropertyDescriptor(
        CharacterData.prototype,
        'data',
    )!;
    Object.defineProperty(CharacterData.prototype, 'data', {
        configurable: true,
        get(this: CharacterData) {
            return dataDesc.get!.call(this);
        },
        set(this: CharacterData, v: string) {
            c.textW++;
            return dataDesc.set!.call(this, v);
        },
    });

    const results = measureComponent('cost-list');

    Element.prototype.setAttribute = origAttr;
    Object.defineProperty(CharacterData.prototype, 'data', dataDesc);

    console.log(
        `\nElemix render cost — compiled _list, reactive 1000-row list (mutations via cmp.state.data):\n${table('keyed _list reconcile', results)}\n`,
    );

    // The fine-grained runtime is O(changed), not O(n): mutating a mounted list
    // never rebuilds existing rows, and a point change touches only its own node.
    const byOp = Object.fromEntries(
        results.map((r) => [r.operation, r]),
    ) as Record<string, Result>;
    expect(byOp['create 1k'].rebuilt).toBe(1000);
    expect(byOp['update 10th'].rebuilt).toBe(0);
    expect(byOp.select.rebuilt).toBe(0);
    expect(byOp.select['node ops']).toBe(0);
    expect(byOp.swap.rebuilt).toBe(0);
    expect(byOp['remove 1'].rebuilt).toBe(0);
});
