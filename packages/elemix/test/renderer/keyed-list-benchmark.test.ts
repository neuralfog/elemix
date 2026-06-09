import { describe, test, expect, beforeEach } from 'vitest';
import { Component, defineComponent } from '../../src/component/Component';
import { html } from '../../src/renderer/render';
import { state } from '../../src/State';
import { repeat } from '../../src/renderer/directives';
import { render } from '../../utilities';

type Row = { id: number; label: string };
type State = { data: Row[]; selected: number };

let nextId = 1;
const buildData = (n: number): Row[] =>
    Array.from({ length: n }, () => {
        const id = nextId++;
        return { id, label: `label ${id}` };
    });

const row = (item: Row, selected: number) =>
    html`<tr class=${item.id === selected ? 'danger' : ''}><td class="id">${item.id}</td><td><a>${item.label}</a></td></tr>`;

const tableTemplate = (s: State, useKey: boolean) =>
    useKey
        ? html`<table><tbody>${repeat(
              s.data,
              (item: Row) => row(item, s.selected),
              (item: Row) => String(item.id),
          )}</tbody></table>`
        : html`<table><tbody>${repeat(
              s.data,
              (item: Row) => row(item, s.selected),
          )}</tbody></table>`;

class ListAppPlain extends Component {
    state = state<State>({ data: [], selected: 0 });
    template = () => tableTemplate(this.state, true);
}
class ListAppAuto extends Component {
    state = state<State>({ data: [], selected: 0 });
    template = () => tableTemplate(this.state, false);
}
defineComponent('list-app-plain', ListAppPlain);
defineComponent('list-app-auto', ListAppAuto);

describe.each([
    ['explicit key', 'list-app-plain'],
    ['auto identity key (no key)', 'list-app-auto'],
])('keyed list operations (%s)', (_name, tag) => {
    let cmp: ListAppPlain;
    const rows = () => Array.from(cmp.shadowRoot!.querySelectorAll('tbody tr'));
    const idOf = (tr: Element) => Number(tr.querySelector('.id')?.textContent);
    const labelOf = (tr: Element) => tr.querySelector('a')?.textContent ?? '';

    beforeEach(async () => {
        nextId = 1;
        document.body.innerHTML = `<${tag}></${tag}>`;
        await render();
        cmp = document.querySelector(tag) as unknown as ListAppPlain;
    });

    test('create: renders all rows with correct id/label and no selection', async () => {
        cmp.state.data.push(...buildData(5));
        await render();

        const trs = rows();
        expect(trs.map(idOf)).toEqual([1, 2, 3, 4, 5]);
        expect(labelOf(trs[0])).toBe('label 1');
        expect(cmp.shadowRoot!.querySelectorAll('tr.danger')).toHaveLength(0);
    });

    test('update every 3rd: changes only matching labels, keeps all node identities', async () => {
        cmp.state.data.push(...buildData(6));
        await render();
        const before = rows();

        const d = cmp.state.data;
        for (let i = 0; i < d.length; i += 3) d[i].label += ' !!!';
        await render();
        const after = rows();

        expect(after).toHaveLength(6);
        for (let i = 0; i < 6; i++) {
            expect(after[i]).toBe(before[i]);
            expect(labelOf(after[i])).toBe(
                i % 3 === 0 ? `label ${i + 1} !!!` : `label ${i + 1}`,
            );
        }
    });

    test('select: toggles danger on one row and moves it on re-select', async () => {
        cmp.state.data.push(...buildData(5));
        await render();
        const trs = rows();

        cmp.state.selected = cmp.state.data[1].id;
        await render();
        expect(cmp.shadowRoot!.querySelectorAll('tr.danger')).toHaveLength(1);
        expect(rows()[1].classList.contains('danger')).toBe(true);
        expect(rows()[1]).toBe(trs[1]);

        cmp.state.selected = cmp.state.data[3].id;
        await render();
        expect(cmp.shadowRoot!.querySelectorAll('tr.danger')).toHaveLength(1);
        expect(rows()[1].classList.contains('danger')).toBe(false);
        expect(rows()[3].classList.contains('danger')).toBe(true);
    });

    test('swap: exchanges two rows by moving the same nodes, order otherwise intact', async () => {
        cmp.state.data.push(...buildData(5));
        await render();
        const before = rows();
        const a = before[1];
        const b = before[3];

        const d = cmp.state.data;
        const tmp = d[1];
        d[1] = d[3];
        d[3] = tmp;
        await render();
        const after = rows();

        expect(after[1]).toBe(b);
        expect(after[3]).toBe(a);
        expect(after[0]).toBe(before[0]);
        expect(after[2]).toBe(before[2]);
        expect(after[4]).toBe(before[4]);
    });

    test('append: keeps existing nodes and adds new rows at the end', async () => {
        cmp.state.data.push(...buildData(3));
        await render();
        const before = rows();

        cmp.state.data.push(...buildData(2));
        await render();
        const after = rows();

        expect(after).toHaveLength(5);
        expect(after[0]).toBe(before[0]);
        expect(after[1]).toBe(before[1]);
        expect(after[2]).toBe(before[2]);
        expect(after.map(idOf)).toEqual([1, 2, 3, 4, 5]);
    });

    test('remove: drops one row, preserves the identity and order of the rest', async () => {
        cmp.state.data.push(...buildData(5));
        await render();
        const before = rows();

        const removedId = cmp.state.data[0].id;
        cmp.state.data.splice(0, 1);
        await render();
        const after = rows();

        expect(after).toHaveLength(4);
        expect(after.some((tr) => idOf(tr) === removedId)).toBe(false);
        for (let i = 0; i < 4; i++) expect(after[i]).toBe(before[i + 1]);
        expect(after.map(idOf)).toEqual([2, 3, 4, 5]);
    });

    test('clear: empties the list', async () => {
        cmp.state.data.push(...buildData(5));
        await render();
        expect(rows()).toHaveLength(5);

        cmp.state.data.splice(0);
        await render();
        expect(rows()).toHaveLength(0);
    });

    test('create → clear → create reuses a clean list', async () => {
        cmp.state.data.push(...buildData(5));
        await render();
        cmp.state.data.splice(0);
        await render();
        cmp.state.data.push(...buildData(3));
        await render();

        expect(rows().map(idOf)).toEqual([6, 7, 8]);
    });
});
