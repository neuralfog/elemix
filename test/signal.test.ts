import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { MainApp } from './fixtures/MainApp';
import { restoreSignal, store } from './fixtures/signal';
import { RenderTrigger } from '../src/types';
import type { TestComp } from './fixtures/TestComp';
import type { ListApp } from './fixtures/ListApp';
import { render } from '../utilities';

import './fixtures/ListApp';
import './fixtures/MainApp';

describe('Signal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        restoreSignal();
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(html`<main-app />`);

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Initial State - Single Component', async () => {
        const presenter = new Present().screen(html`<list-app />`);

        await render();

        expect(HTML(presenter.root<ListApp>())).toMatchSnapshot();
    });

    test('Initial State - Multiple Component', async () => {
        const presenter = new Present().screen(html`<list-app />`);
        const listApp = presenter.root<ListApp>();
        listApp.state.count = 5;

        await render();

        expect(HTML(presenter.root<ListApp>())).toMatchSnapshot();
    });

    test('Modify Signal', async () => {
        const presenter = new Present().screen(html`<main-app />`);

        await render();

        const testComp = presenter.getByTag<TestComp>('test-comp');
        const onRender = vi.spyOn(testComp, 'onRender');

        expect(store.value.value).toBe('Initial Signal Value');
        store.value.value = 'New Value';

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toBeCalledWith([RenderTrigger.SIGNAL]);
    });
});

describe('Signal Cleanup', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        restoreSignal();
    });

    test('Single Component', async () => {
        const presenter = new Present().screen(html`<list-app />`);

        await render();

        expect(store.subscribers.size).toBe(1);

        const listApp = presenter.root<ListApp>();
        listApp.state.count = 0;

        await render();

        expect(store.subscribers.size).toBe(0);
    });

    test('Multiple Component', async () => {
        const presenter = new Present().screen(html`<list-app />`);
        const listApp = presenter.root<ListApp>();
        listApp.state.count = 5;

        await render();

        expect(store.subscribers.size).toBe(5);

        listApp.state.count = 0;

        await render();

        expect(store.subscribers.size).toBe(0);
    });
});
