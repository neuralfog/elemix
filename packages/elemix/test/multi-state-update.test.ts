import { expect, test, describe, beforeEach } from 'vitest';
import { HTML } from '../testing/snapshots';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import { render } from '../utilities';
import type { MainApp } from './fixtures/MainApp';
import type { TestComp } from './fixtures/TestComp';
import { restoreSignal, store } from './fixtures/Signal';

import './fixtures/MainApp';

describe('Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        restoreSignal();
    });

    test('Initial State', async () => {
        const presenter = present().screen(html`<main-app></main-app>`);

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });

    test('Modify Props, State and Signal', async () => {
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
        store.value.value = 'New Signal Value';
        testComp.state.string = 'New state Value';
        testComp.state2.number = 10;

        await render();

        expect(HTML(presenter.root<MainApp>())).toMatchSnapshot();
    });
});
