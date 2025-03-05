import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { StateApp } from './fixtures/StateApp';
import { RenderTrigger } from '../src/types';
import { render } from '../utilities';

import './fixtures/StateApp';

describe('State', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(html`<state-app />`);

        await render();

        expect(HTML(presenter.root<StateApp>())).toMatchSnapshot();
    });

    test('Modify State', async () => {
        const presenter = new Present().screen(html`<state-app />`);

        await render();

        const mainApp = presenter.root<StateApp>();
        const onRender = vi.spyOn(mainApp, 'onRender');

        mainApp.state.string = 'New Value';
        mainApp.state.number = 10;
        mainApp.state.object.nested.value = 'New Value';
        mainApp.state.list.push('banana');

        await render();

        expect(HTML(presenter.root<StateApp>())).toMatchSnapshot();
        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toBeCalledWith([RenderTrigger.LOCAL_STATE]);
    });
});
