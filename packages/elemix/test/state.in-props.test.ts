import { expect, test, describe, beforeEach } from 'vitest';
import { HTML } from '../testing/snapshots';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import type { StateInProps, StateInPropsChild } from './fixtures/StateInProps';
import { render } from '../utilities';

import './fixtures/StateInProps';

describe('State In Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = present().screen(
            html`<state-in-props></state-in-props>`,
        );

        await render();

        expect(HTML(presenter.root<StateInProps>())).toMatchSnapshot();
    });

    test('Change Value State In Props', async () => {
        const presenter = present().screen(
            html`<state-in-props></state-in-props>`,
        );

        await render();

        const child = presenter.getComponent<StateInPropsChild>(
            'state-in-props-child',
        );

        await render();

        child.props.state.nestedValue = 'Changed Value From Child Level';

        await render();

        expect(HTML(presenter.root<StateInProps>())).toMatchSnapshot();
    });
});
