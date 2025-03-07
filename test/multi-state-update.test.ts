import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import { render } from '../utilities';
import type { MainApp } from './fixtures/MainApp';
import type { TestComp } from './fixtures/TestComp';
import { restoreSignal, store } from './fixtures/Signal';
import { RenderTrigger } from '../src/types';

import './fixtures/MainApp';

describe('Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        restoreSignal();
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(html`<main-app />`);

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Modify Props, State and Signal', async () => {
        const presenter = new Present().screen(html`<main-app />`);

        await render();

        const testComp = presenter.getComponent<TestComp>('test-comp');
        const onRender = vi.spyOn(testComp, 'onRender');

        expect(testComp.props).toMatchObject({
            color: 'Initial Color',
            size: 0,
        });

        const mainApp = presenter.root<MainApp>();
        mainApp.state.color = 'purple';
        mainApp.state.size = 6;
        store.value.value = 'New Signal Value';
        testComp.state.string = 'New state Value';
        testComp.state2.number = 10;

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toBeCalledWith([
            RenderTrigger.SIGNAL,
            RenderTrigger.LOCAL_STATE,
            RenderTrigger.PROPS,
        ]);
    });
});
