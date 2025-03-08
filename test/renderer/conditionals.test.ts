import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import { render } from '../../utilities';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import {
    State,
    type ConditionalRendering,
} from '../fixtures/renderer/ConditionalRendering';

import '../fixtures/renderer/ConditionalRendering.ts';

describe('Render Conditionals', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('single', async () => {
        // Initial State
        const presenter = new Present().screen(html`<conditional-rendering />`);
        const component = presenter.getComponent<ConditionalRendering>(
            'conditional-rendering',
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();

        component.state.condition = false;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('start', async () => {
        const presenter = new Present().screen(html`<conditional-rendering />`);
        const component = presenter.getComponent<ConditionalRendering>(
            'conditional-rendering',
        );

        component.state.condition = true;
        component.state.case = State.START;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();

        component.state.condition = false;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('end', async () => {
        const presenter = new Present().screen(html`<conditional-rendering />`);
        const component = presenter.getComponent<ConditionalRendering>(
            'conditional-rendering',
        );

        component.state.condition = true;
        component.state.case = State.END;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();

        component.state.condition = false;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('middle', async () => {
        const presenter = new Present().screen(html`<conditional-rendering />`);
        const component = presenter.getComponent<ConditionalRendering>(
            'conditional-rendering',
        );

        component.state.condition = true;
        component.state.case = State.MIDDLE;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();

        component.state.condition = false;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
