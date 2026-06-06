import { expect, test, describe, beforeEach } from 'vitest';
import { HTML } from '../testing/snapshots';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import type { StateApp } from './fixtures/StateApp';
import { render } from '../utilities';

import './fixtures/StateApp';

describe('State', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = present().screen(html`<state-app></state-app>`);

        await render();

        expect(HTML(presenter.root<StateApp>())).toMatchSnapshot();
    });

    test('Modify State', async () => {
        const presenter = present().screen(html`<state-app></state-app>`);

        await render();

        const mainApp = presenter.root<StateApp>();

        mainApp.state.string = 'New Value';
        mainApp.state.number = 10;
        mainApp.state.object.nested.value = 'New Value';
        mainApp.state.list.push('banana');

        await render();

        expect(HTML(presenter.root<StateApp>())).toMatchSnapshot();
    });
});
