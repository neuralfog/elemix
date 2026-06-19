import { describe, expect, test } from 'vitest';
import { _list } from '../src/runtime/dom';
import { state } from '../src/runtime/state';

type Row = { id: number };
const rows = (ids: number[]): Row[] => ids.map((id) => ({ id }));

// deterministic LCG so a failure is reproducible
const makeRand = (seed: number) => {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
};

const setup = (initial: number[]) => {
    const container = document.createElement('div');
    const anchor = document.createComment('');
    container.appendChild(anchor);
    document.body.appendChild(container);

    const st = state<{ list: Row[] }>({ list: rows(initial) });
    const node = new Map<number, Node>();
    const renderCount = new Map<number, number>();

    _list(
        anchor,
        () => st.list,
        (item) => item.id,
        (item) => {
            renderCount.set(item.id, (renderCount.get(item.id) ?? 0) + 1);
            const el = document.createElement('span');
            el.textContent = String(item.id);
            node.set(item.id, el);
            return el;
        },
    );

    const domRows = () =>
        Array.from(container.childNodes).filter((c) => c !== anchor);

    return { container, anchor, st, node, renderCount, domRows };
};

describe('_list reconciler', () => {
    test('initial mount renders in order', () => {
        const t = setup([0, 1, 2, 3, 4]);
        const ids = t.domRows().map((n) => Number(n.textContent));
        expect(ids).toEqual([0, 1, 2, 3, 4]);
    });

    test('fuzz: DOM order, node identity and no re-render of survivors', () => {
        const t = setup([0, 1, 2, 3, 4]);
        const rand = makeRand(0xc0ffee);
        let nextId = 5;

        for (let iter = 0; iter < 800; iter++) {
            const cur = t.st.list.map((x) => x.id);
            let next = cur.slice();
            const op = Math.floor(rand() * 8);

            if (op === 0) {
                for (let i = next.length - 1; i > 0; i--) {
                    const j = Math.floor(rand() * (i + 1));
                    [next[i], next[j]] = [next[j], next[i]];
                }
            } else if (op === 1 && next.length >= 2) {
                const a = Math.floor(rand() * next.length);
                const b = Math.floor(rand() * next.length);
                [next[a], next[b]] = [next[b], next[a]];
            } else if (op === 2) {
                const n = 1 + Math.floor(rand() * 3);
                for (let k = 0; k < n; k++) {
                    const pos = Math.floor(rand() * (next.length + 1));
                    next.splice(pos, 0, nextId++);
                }
            } else if (op === 3 && next.length > 0) {
                const n = 1 + Math.floor(rand() * Math.min(3, next.length));
                for (let k = 0; k < n; k++) {
                    next.splice(Math.floor(rand() * next.length), 1);
                }
            } else if (op === 4) {
                next.reverse();
            } else if (op === 5) {
                next = [];
            } else if (op === 6) {
                const n = Math.floor(rand() * 6);
                next = [];
                for (let k = 0; k < n; k++) next.push(nextId++);
            }
            // op === 7: no structural change (re-set identical order)

            const survivors = next.filter((id) => cur.includes(id));

            t.st.list = rows(next);

            const dom = t.domRows();
            expect(dom.map((n) => Number(n.textContent))).toEqual(next);
            // each position holds the exact node instance bound to that id
            for (let p = 0; p < next.length; p++) {
                expect(dom[p]).toBe(t.node.get(next[p]));
            }
            // survivors keep their node — never re-rendered
            for (const id of survivors) {
                expect(t.renderCount.get(id)).toBe(1);
            }
        }
    });

    test('swap two distant rows moves only those nodes', () => {
        const t = setup(Array.from({ length: 20 }, (_, i) => i));
        const before = t.domRows();
        const swapped = Array.from({ length: 20 }, (_, i) => i);
        [swapped[1], swapped[18]] = [swapped[18], swapped[1]];
        t.st.list = rows(swapped);

        const after = t.domRows();
        expect(after.map((n) => Number(n.textContent))).toEqual(swapped);
        // every node instance is reused (no row re-created on a pure swap)
        for (let i = 0; i < 20; i++) {
            expect(t.node.get(i)).toBe(before[i]);
        }
        expect(t.renderCount.size).toBe(20);
    });

    test('in-place reactive swap converges (transient duplicate key survived)', () => {
        const t = setup(Array.from({ length: 20 }, (_, i) => i));
        // Mutating the reactive array in place fires a reconcile per index write.
        // The first write leaves a transient DUPLICATE key (id 18 in two slots) —
        // the reconciler must bail on that pass and let the next (unique) pass do
        // the real swap, never throwing.
        const data = t.st.list;
        const tmp = data[1];
        data[1] = data[18];
        data[18] = tmp;

        const want = Array.from({ length: 20 }, (_, i) => i);
        [want[1], want[18]] = [want[18], want[1]];
        expect(t.domRows().map((n) => Number(n.textContent))).toEqual(want);
        expect(t.domRows().length).toBe(20);
    });

    test('clear removes all rows, keeps the anchor', () => {
        const t = setup([0, 1, 2, 3, 4]);
        t.st.list = [];
        expect(t.domRows()).toEqual([]);
        expect(t.anchor.parentNode).toBe(t.container);
    });

    test('full replace swaps every row', () => {
        const t = setup([0, 1, 2]);
        t.st.list = rows([10, 11, 12]);
        expect(t.domRows().map((n) => Number(n.textContent))).toEqual([
            10, 11, 12,
        ]);
    });
});
