import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';

import './fixtures/StateApp';
import type { StateApp } from './fixtures/StateApp';
import { UNSUPPORTED_COLLECTION_ERROR_MESSAGE } from '../src/Reactive';

describe('Unsupported State Properties', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Unsupported Set', async () => {
        const presenter = new Present().screen(html`<state-app />`);
        await presenter.wait();

        const mainApp = presenter.root<StateApp>();
        mainApp.state.any = new Set();

        try {
            mainApp.state.any.add(1);
        } catch (e) {
            if (e instanceof Error) {
                expect(e.message).toBe(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
            }
        }
    });

    test('Unsupported WeakSet', async () => {
        const presenter = new Present().screen(html`<state-app />`);
        await presenter.wait();

        const mainApp = presenter.root<StateApp>();
        mainApp.state.any = new WeakSet();

        try {
            mainApp.state.any.add({});
        } catch (e) {
            if (e instanceof Error) {
                expect(e.message).toBe(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
            }
        }
    });

    test('Unsupported Map', async () => {
        const presenter = new Present().screen(html`<state-app />`);
        await presenter.wait();

        const mainApp = presenter.root<StateApp>();
        mainApp.state.any = new Map();

        try {
            mainApp.state.any.set('key', {});
        } catch (e) {
            if (e instanceof Error) {
                expect(e.message).toBe(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
            }
        }
    });

    test('Unsupported WeakMap', async () => {
        const presenter = new Present().screen(html`<state-app />`);
        await presenter.wait();

        const mainApp = presenter.root<StateApp>();
        mainApp.state.any = new WeakMap();

        try {
            mainApp.state.any.set('key', {});
        } catch (e) {
            if (e instanceof Error) {
                expect(e.message).toBe(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
            }
        }
    });
});
