import { describe, test, expect, beforeEach } from 'vitest';
import { html, render } from '../../src/renderer/render';
import { repeat } from '../../src/renderer/directives';

// render() caches fragments on the container keyed by the template's `strings`
// identity, so each test gets a fresh container to stay isolated.
let root: HTMLElement;

beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
});

describe('Keyed list — multi-node items', () => {
    describe('item template with surrounding whitespace', () => {
        type Item = { id: string; name: string };
        const t = (list: Item[]) =>
            html`<ul>${repeat(
                list,
                (item) => html`
                    <li>${item.name}</li>
                `,
                (item) => item.id,
            )}</ul>`;

        test('delete removes the element, not just an adjacent whitespace node', () => {
            const items: Item[] = [
                { id: 'a', name: 'Alice' },
                { id: 'b', name: 'Bob' },
                { id: 'c', name: 'Charlie' },
            ];
            render(t(items), root);
            expect(root.querySelectorAll('li').length).toBe(3);

            render(t([items[0], items[2]]), root);
            const lis = root.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(Array.from(lis).map((l) => l.textContent?.trim())).toEqual([
                'Alice',
                'Charlie',
            ]);
        });

        test('clears all elements when the list empties', () => {
            const items: Item[] = [
                { id: 'a', name: 'Alice' },
                { id: 'b', name: 'Bob' },
            ];
            render(t(items), root);
            expect(root.querySelectorAll('li').length).toBe(2);

            render(t([]), root);
            expect(root.querySelectorAll('li').length).toBe(0);
        });
    });

    describe('item template with multiple root elements', () => {
        type Entry = { id: string; term: string; def: string };
        const t = (list: Entry[]) =>
            html`<dl>${repeat(
                list,
                (e) => html`<dt>${e.term}</dt><dd>${e.def}</dd>`,
                (e) => e.id,
            )}</dl>`;

        const seq = (): string[] =>
            Array.from((root.querySelector('dl') as HTMLElement).children).map(
                (el) => `${el.tagName}:${el.textContent}`,
            );

        const entries: Entry[] = [
            { id: 'a', term: 'A', def: 'Apple' },
            { id: 'b', term: 'B', def: 'Banana' },
            { id: 'c', term: 'C', def: 'Cherry' },
        ];

        test('mounts every root node of each item', () => {
            render(t(entries), root);
            expect(root.querySelectorAll('dt').length).toBe(3);
            expect(root.querySelectorAll('dd').length).toBe(3);
            expect(seq()).toEqual([
                'DT:A',
                'DD:Apple',
                'DT:B',
                'DD:Banana',
                'DT:C',
                'DD:Cherry',
            ]);
        });

        test('delete removes both root nodes of the item', () => {
            render(t(entries), root);
            render(t([entries[0], entries[2]]), root);
            expect(root.querySelectorAll('dt').length).toBe(2);
            expect(root.querySelectorAll('dd').length).toBe(2);
            expect(seq()).toEqual(['DT:A', 'DD:Apple', 'DT:C', 'DD:Cherry']);
        });

        test('reorder moves the whole item as a unit', () => {
            render(t(entries), root);
            render(t([...entries].reverse()), root);
            expect(seq()).toEqual([
                'DT:C',
                'DD:Cherry',
                'DT:B',
                'DD:Banana',
                'DT:A',
                'DD:Apple',
            ]);
        });

        test('insert places every root node at the right position', () => {
            render(t([entries[0], entries[2]]), root);
            render(t(entries), root);
            expect(seq()).toEqual([
                'DT:A',
                'DD:Apple',
                'DT:B',
                'DD:Banana',
                'DT:C',
                'DD:Cherry',
            ]);
        });

        test('preserves DOM node identity for items that are not recreated', () => {
            render(t(entries), root);
            const dtA = root.querySelectorAll('dt')[0];
            const ddA = root.querySelectorAll('dd')[0];

            render(t([entries[1], entries[0], entries[2]]), root);

            const dts = root.querySelectorAll('dt');
            const dds = root.querySelectorAll('dd');
            const idxA = Array.from(dts).findIndex(
                (el) => el.textContent === 'A',
            );
            expect(dts[idxA]).toBe(dtA);
            expect(dds[idxA]).toBe(ddA);
            expect(seq()).toEqual([
                'DT:B',
                'DD:Banana',
                'DT:A',
                'DD:Apple',
                'DT:C',
                'DD:Cherry',
            ]);
        });
    });
});
