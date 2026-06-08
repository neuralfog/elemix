import { expect, test, describe, beforeEach } from 'vitest';
import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { state } from '../../src/State';
import { when, choose } from '../../src/renderer/directives';
import { present } from '../../testing';
import { render } from '../../utilities';
import type { WhenChoose } from '../fixtures/renderer/WhenChoose';

import '../fixtures/renderer/WhenChoose';

const sel = (c: Component, s: string): string | null | undefined =>
    c.root?.querySelector(s)?.textContent?.trim();
const count = (c: Component, s: string): number =>
    c.root?.querySelectorAll(s).length ?? 0;

// `when` probe — counts how often each branch factory runs.
class WhenProbe extends Component {
    state = state<{ cond: unknown }>({ cond: true });
    thenCalls = 0;
    elseCalls = 0;

    template = (): Template =>
        html`<div>${when(
            this.state.cond,
            () => {
                this.thenCalls++;
                return html`<span class="t">then</span>`;
            },
            () => {
                this.elseCalls++;
                return html`<span class="e">else</span>`;
            },
        )}</div>`;
}
defineComponent('when-probe', WhenProbe);

// `choose` probe — three cases, counts which factories run.
class ChooseProbe extends Component {
    state = state<{ a: unknown; b: unknown; c: unknown }>({
        a: false,
        b: false,
        c: false,
    });
    calls = [0, 0, 0];

    template = (): Template =>
        html`<div>${choose([
            [
                this.state.a,
                () => {
                    this.calls[0]++;
                    return html`<span class="r">a</span>`;
                },
            ],
            [
                this.state.b,
                () => {
                    this.calls[1]++;
                    return html`<span class="r">b</span>`;
                },
            ],
            [
                this.state.c,
                () => {
                    this.calls[2]++;
                    return html`<span class="r">c</span>`;
                },
            ],
        ])}</div>`;
}
defineComponent('choose-probe', ChooseProbe);

class ChooseEmpty extends Component {
    template = (): Template => html`<div class="box">${choose([])}</div>`;
}
defineComponent('choose-empty', ChooseEmpty);

// Lifecycle: a child whose mount/dispose we can observe across toggles.
const life = { mounts: 0, disposes: 0 };
class LifeChild extends Component {
    onMount(): void {
        life.mounts++;
    }
    onDispose(): void {
        life.disposes++;
    }
    template = (): Template => html`<span class="child">child</span>`;
}
defineComponent('life-child', LifeChild);

class WhenLife extends Component {
    state = state<{ show: boolean }>({ show: false });
    template = (): Template =>
        html`<div>${when(this.state.show, () => html`<life-child></life-child>`)}</div>`;
}
defineComponent('when-life', WhenLife);

// Active branch with its own reactive hole.
class WhenNested extends Component {
    state = state<{ show: boolean; n: number }>({ show: true, n: 0 });
    template = (): Template =>
        html`<div>${when(this.state.show, () => html`<span class="n">${this.state.n}</span>`)}</div>`;
}
defineComponent('when-nested', WhenNested);

const truthiness: Array<[unknown, boolean]> = [
    [false, false],
    [0, false],
    ['', false],
    [null, false],
    [undefined, false],
    [Number.NaN, false],
    [true, true],
    [1, true],
    ['x', true],
    [{}, true],
    [[], true],
];

describe('Directives — when / choose', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        life.mounts = 0;
        life.disposes = 0;
    });

    // --- when: basic swap (fixture) ---
    test('when renders the then branch and swaps to otherwise', async () => {
        const presenter = present().screen(html`<when-choose></when-choose>`);
        const c = presenter.getComponent<WhenChoose>('when-choose');
        await render();
        expect(sel(c, '.when .open')).toBe('open');
        expect(c.root?.querySelector('.when .closed')).toBeNull();

        c.state.open = false;
        await render();
        expect(sel(c, '.when .closed')).toBe('closed');
        expect(c.root?.querySelector('.when .open')).toBeNull();
    });

    test('when without otherwise renders nothing when falsy', async () => {
        const presenter = present().screen(html`<when-choose></when-choose>`);
        const c = presenter.getComponent<WhenChoose>('when-choose');
        await render();
        expect(sel(c, '.bare .only')).toBe('only');

        c.state.open = false;
        await render();
        expect(c.root?.querySelector('.bare .only')).toBeNull();
    });

    // --- when: laziness ---
    test('when only ever invokes the active branch factory', async () => {
        const presenter = present().screen(html`<when-probe></when-probe>`);
        const c = presenter.getComponent<WhenProbe>('when-probe');
        await render();
        expect(c.thenCalls).toBeGreaterThan(0);
        expect(c.elseCalls).toBe(0);

        const thenSnapshot = c.thenCalls;
        c.state.cond = false;
        await render();
        expect(c.elseCalls).toBeGreaterThan(0);
        // the then factory must not run again while the else branch is active
        expect(c.thenCalls).toBe(thenSnapshot);
    });

    // --- when: truthiness ---
    test('when follows JS truthiness for its condition', async () => {
        const presenter = present().screen(html`<when-probe></when-probe>`);
        const c = presenter.getComponent<WhenProbe>('when-probe');
        for (const [value, truthy] of truthiness) {
            c.state.cond = value;
            await render();
            expect(count(c, '.t')).toBe(truthy ? 1 : 0);
            expect(count(c, '.e')).toBe(truthy ? 0 : 1);
        }
    });

    // --- when: repeated toggling leaves no residue ---
    test('when toggles cleanly back and forth', async () => {
        const presenter = present().screen(html`<when-probe></when-probe>`);
        const c = presenter.getComponent<WhenProbe>('when-probe');
        for (const cond of [true, false, true, false, true]) {
            c.state.cond = cond;
            await render();
            expect(count(c, '.t')).toBe(cond ? 1 : 0);
            expect(count(c, '.e')).toBe(cond ? 0 : 1);
        }
    });

    // --- when: active branch updates in place ---
    test('active when branch updates on its own state change', async () => {
        const presenter = present().screen(html`<when-nested></when-nested>`);
        const c = presenter.getComponent<WhenNested>('when-nested');
        await render();
        const span = c.root?.querySelector('.n');
        expect(span?.textContent?.trim()).toBe('0');

        c.state.n = 5;
        await render();
        // same node, updated in place (not recreated)
        expect(c.root?.querySelector('.n')).toBe(span);
        expect(sel(c, '.n')).toBe('5');
    });

    // --- when: structural mount/dispose of a child component ---
    test('when structurally mounts and disposes a child component', async () => {
        const presenter = present().screen(html`<when-life></when-life>`);
        const c = presenter.getComponent<WhenLife>('when-life');
        await render();
        expect(life.mounts).toBe(0);
        expect(c.root?.querySelector('life-child')).toBeNull();

        c.state.show = true;
        await render();
        expect(life.mounts).toBe(1);
        expect(c.root?.querySelector('life-child')).toBeTruthy();

        c.state.show = false;
        await render();
        expect(life.disposes).toBe(1);
        expect(c.root?.querySelector('life-child')).toBeNull();

        c.state.show = true;
        await render();
        expect(life.mounts).toBe(2);
    });

    // --- choose: basic (fixture) ---
    test('choose picks the first truthy case, with [true] as else', async () => {
        const presenter = present().screen(html`<when-choose></when-choose>`);
        const c = presenter.getComponent<WhenChoose>('when-choose');
        await render();
        expect(sel(c, '.choose .role')).toBe('Admin');

        c.state.role = 'editor';
        await render();
        expect(sel(c, '.choose .role')).toBe('Editor');

        c.state.role = 'guest';
        await render();
        expect(sel(c, '.choose .role')).toBe('Guest');
    });

    // --- choose: short-circuit + laziness ---
    test('choose matches the first truthy case and skips the rest', async () => {
        const presenter = present().screen(html`<choose-probe></choose-probe>`);
        const c = presenter.getComponent<ChooseProbe>('choose-probe');
        c.state.b = true;
        c.state.c = true;
        await render();
        expect(sel(c, '.r')).toBe('b');
        expect(c.calls[0]).toBe(0); // a was falsy
        expect(c.calls[1]).toBeGreaterThan(0); // b matched
        expect(c.calls[2]).toBe(0); // c never reached
    });

    test('choose with no matching case renders nothing', async () => {
        const presenter = present().screen(html`<choose-probe></choose-probe>`);
        const c = presenter.getComponent<ChooseProbe>('choose-probe');
        await render();
        expect(c.root?.querySelector('.r')).toBeNull();
        expect(c.calls).toEqual([0, 0, 0]);
    });

    test('choose re-selects when conditions change', async () => {
        const presenter = present().screen(html`<choose-probe></choose-probe>`);
        const c = presenter.getComponent<ChooseProbe>('choose-probe');
        c.state.a = true;
        await render();
        expect(sel(c, '.r')).toBe('a');

        c.state.a = false;
        c.state.c = true;
        await render();
        expect(sel(c, '.r')).toBe('c');
        expect(count(c, '.r')).toBe(1);
    });

    test('choose with empty cases renders nothing', async () => {
        const presenter = present().screen(html`<choose-empty></choose-empty>`);
        const c = presenter.getComponent<ChooseEmpty>('choose-empty');
        await render();
        expect(c.root?.querySelector('.box')?.children.length).toBe(0);
    });
});
