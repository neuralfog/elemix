import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '../testing/snapshots';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';
import type { MainApp } from './fixtures/MainApp';
import type { TestComp } from './fixtures/TestComp';

import './fixtures/MainApp';

describe('Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = present().screen(html`<main-app></main-app>`);

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Modify Props', async () => {
        const presenter = present().screen(html`<main-app></main-app>`);

        await render();

        const testComp = presenter.getComponent<TestComp>('test-comp');

        expect(testComp.props).toMatchObject({
            color: 'Initial Color',
            size: 0,
        });

        const mainApp = presenter.root<MainApp>();
        mainApp.state.color = 'purple';
        mainApp.state.size = 6;

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Diffing Primitives And Handlers', async () => {
        const presenter = present().screen(html`<main-app></main-app>`);

        await render();

        const testComp = presenter.getComponent<TestComp>('test-comp');
        const onMutation = vi.spyOn(testComp, 'onMutation');

        const mainApp = presenter.root<MainApp>();
        mainApp.state.string = 'random stuff';

        await render();

        mainApp.state.string = 'random stuff 2';

        await render();

        mainApp.state.string = 'random stuff 3';

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
        expect(onMutation).toBeCalledTimes(0);
    });
});
