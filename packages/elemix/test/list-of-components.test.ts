import { describe, test, expect, beforeEach } from 'vitest';
import { Component, defineComponent } from '../src/component/Component';
import { html } from '../src/renderer/render';
import { state } from '../src/State';
import { repeat } from '../src/renderer/directives';
import { render } from '../utilities';

const mounts: string[] = [];
const disposes: string[] = [];

type ChildProps = { label: string };
class ListChild extends Component<ChildProps> {
    onMount = (): void => {
        mounts.push(this.props.label);
    };
    onDispose = (): void => {
        disposes.push(this.props.label);
    };
    template = () => html`<span class="child">${this.props.label}</span>`;
}
defineComponent('list-child', ListChild);

type Row = { id: number; label: string };
class ListOwner extends Component {
    state = state<{ rows: Row[] }>({ rows: [] });
    template = () =>
        html`<div>${repeat(
            this.state.rows,
            (r: Row) => html`<list-child :label=${r.label}></list-child>`,
            (r: Row) => String(r.id),
        )}</div>`;
}
defineComponent('list-owner', ListOwner);

const flush = async (): Promise<void> => {
    await render();
    await render();
    await render();
};

describe('list of components (mount lifecycle)', () => {
    let cmp: ListOwner;
    const children = () =>
        Array.from(cmp.shadowRoot!.querySelectorAll('list-child'));
    const labels = () =>
        children().map(
            (c) => c.shadowRoot?.querySelector('.child')?.textContent,
        );

    beforeEach(async () => {
        mounts.length = 0;
        disposes.length = 0;
        document.body.innerHTML = '<list-owner></list-owner>';
        await flush();
        cmp = document.querySelector('list-owner') as unknown as ListOwner;
    });

    test('mounts a child component per row with props + onMount', async () => {
        cmp.state.rows = [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
            { id: 3, label: 'c' },
        ];
        await flush();
        expect(children().length).toBe(3);
        expect(labels()).toEqual(['a', 'b', 'c']);
        expect(mounts).toEqual(['a', 'b', 'c']);
    });

    test('appending a row mounts exactly one more child', async () => {
        cmp.state.rows = [{ id: 1, label: 'a' }];
        await flush();
        mounts.length = 0;
        cmp.state.rows.push({ id: 2, label: 'b' });
        await flush();
        expect(children().length).toBe(2);
        expect(labels()).toEqual(['a', 'b']);
        expect(mounts).toEqual(['b']);
    });

    test('removing a row disposes its child', async () => {
        cmp.state.rows = [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
            { id: 3, label: 'c' },
        ];
        await flush();
        disposes.length = 0;
        cmp.state.rows.splice(1, 1);
        await flush();
        expect(labels()).toEqual(['a', 'c']);
        expect(disposes).toEqual(['b']);
    });
});
