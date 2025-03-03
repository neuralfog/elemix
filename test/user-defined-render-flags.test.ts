import { expect, test, describe, beforeEach, vi } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import {
    CUSTOM_STATE_FLAG_1,
    CUSTOM_STATE_FLAG_2,
    type FlagsApp,
} from './fixtures/FlagsApp';

import './fixtures/FlagsApp';
import {
    CUSTOM_SIGNAL_FLAG,
    signalWithFlag,
} from './fixtures/signalCustomFlag';

describe('User Defined Render Flags', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('onRender called with user defined flags', async () => {
        const presenter = new Present().screen(html`<flags-app />`);
        const flagsApp = presenter.root<FlagsApp>();

        await presenter.wait();

        const onRender = vi.spyOn(flagsApp, 'onRender');

        flagsApp.state.value = 'New Value';
        flagsApp.state2.value = 'New Value';
        signalWithFlag.value.value = 'New Value';

        await presenter.wait();

        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toHaveBeenCalledWith([
            CUSTOM_STATE_FLAG_1,
            CUSTOM_STATE_FLAG_2,
            CUSTOM_SIGNAL_FLAG,
        ]);
    });
});
