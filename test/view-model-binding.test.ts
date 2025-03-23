import { expect, test, describe, beforeEach } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { ViewModelBindingApp } from './fixtures/ViewModelBinding';
import { render } from '../utilities';

import './fixtures/ViewModelBinding';

describe('View Model Binding', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(
            html`<view-model-binding-app />`,
        );
        const viewModelApp = presenter.root<ViewModelBindingApp>();

        await render();

        expect(HTML(viewModelApp)).toMatchSnapshot();
    });

    test('Update Input Value', async () => {
        const presenter = new Present().screen(
            html`<view-model-binding-app />`,
        );
        const viewModelApp = presenter.root<ViewModelBindingApp>();

        await render();

        const input = presenter.getComponent<HTMLInputElement>('input');
        input.value = 'Brown Hounds';

        const event = new Event('input', {
            bubbles: true,
        });
        input.dispatchEvent(event);

        await render();

        expect(viewModelApp.state.input.value).toBe('Brown Hounds');
        expect(HTML(viewModelApp)).toMatchSnapshot();
    });

    test('Update View Model', async () => {
        const presenter = new Present().screen(
            html`<view-model-binding-app />`,
        );
        const viewModelApp = presenter.root<ViewModelBindingApp>();
        viewModelApp.state.input.value = 'Brown Hounds';

        await render();

        expect(HTML(viewModelApp)).toMatchSnapshot();

        const input = presenter.getComponent<HTMLInputElement>('input');
        expect(input.value).toBe('Brown Hounds');
    });
});
