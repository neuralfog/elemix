import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import { render } from '../../utilities';
import { HTML } from '@neuralfog/elemix-testing/snapshots';

import '../fixtures/renderer/SelfClosingTags';
import {
    type SelfClosingTags,
    State,
} from '../fixtures/renderer/SelfClosingTags';

describe('Renderer Self Closing Tags', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('single', async () => {
        const presenter = new Present().screen(html`<self-closing-tags />`);
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('start', async () => {
        const presenter = new Present().screen(html`<self-closing-tags />`);
        const component =
            presenter.getComponent<SelfClosingTags>('self-closing-tags');

        component.state.case = State.START;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('end', async () => {
        const presenter = new Present().screen(html`<self-closing-tags />`);
        const component =
            presenter.getComponent<SelfClosingTags>('self-closing-tags');

        component.state.case = State.END;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('middle', async () => {
        const presenter = new Present().screen(html`<self-closing-tags />`);
        const component =
            presenter.getComponent<SelfClosingTags>('self-closing-tags');

        component.state.case = State.MIDDLE;
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });
});
