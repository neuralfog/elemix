import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';

import './fixtures/MainApp';
import type { MainApp } from './fixtures/MainApp';
import type { TestComp } from './fixtures/TestComp';
import { RenderTrigger } from '../src/types';

describe('Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(html`<main-app />`);

        await presenter.wait();
        await presenter.wait();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Modify Props', async () => {
        const presenter = new Present().screen(html`<main-app />`);
        await presenter.wait();
        await presenter.wait();

        const testComp = presenter.getByTag<TestComp>('test-comp');
        const onRender = vi.spyOn(testComp, 'onRender');

        expect(testComp.props).toMatchObject({
            color: 'Initial Color',
            size: 0,
        });

        const mainApp = presenter.root<MainApp>();
        mainApp.state.color = 'purple';
        mainApp.state.size = 6;

        await presenter.wait();
        await presenter.wait();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toBeCalledWith([RenderTrigger.PROPS]);
    });

    test('Diffing Primitives And Handlers', async () => {
        const presenter = new Present().screen(html`<main-app />`);
        await presenter.wait(100);
        await presenter.wait();

        const testComp = presenter.getByTag<TestComp>('test-comp');
        const onRender = vi.spyOn(testComp, 'onRender');

        const mainApp = presenter.root<MainApp>();
        mainApp.state.string = 'random stuff';

        await presenter.wait();
        await presenter.wait();

        mainApp.state.string = 'random stuff 2';

        await presenter.wait();
        await presenter.wait();

        mainApp.state.string = 'random stuff 3';

        await presenter.wait();
        await presenter.wait();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
        expect(onRender).toBeCalledTimes(0);
    });
});
