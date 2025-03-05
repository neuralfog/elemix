import { expect, test, describe, beforeEach, vi } from 'vitest';
import { HTML } from '@neuralfog/elemix-testing/snapshots';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { StateInProps, StateInPropsChild } from './fixtures/StateInProps';
import { RenderTrigger } from '../src/types';
import { render } from '../utilities';

import './fixtures/StateInProps';

describe('State In Props', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('Initial State', async () => {
        const presenter = new Present().screen(html`<state-in-props />`);

        await render();

        expect(HTML(presenter.root<StateInProps>())).toMatchSnapshot();
    });

    test('Change Value State In Props', async () => {
        const presenter = new Present().screen(html`<state-in-props />`);
        const parent = presenter.root<StateInProps>();

        await render();

        const child = presenter.getByTag<StateInPropsChild>(
            'state-in-props-child',
        );

        await render();

        const onRenderParent = vi.spyOn(parent, 'onRender');
        const onRenderChild = vi.spyOn(child, 'onRender');

        child.props.state.nestedValue = 'Changed Value From Child Level';

        await render();

        expect(onRenderParent).toHaveBeenCalledOnce();
        expect(onRenderParent).toHaveBeenCalledWith([
            RenderTrigger.LOCAL_STATE,
        ]);
        expect(onRenderChild).toHaveBeenCalledOnce();
        expect(onRenderChild).toHaveBeenCalledWith([RenderTrigger.PROPS]);

        expect(HTML(presenter.root<StateInProps>())).toMatchSnapshot();
    });
});
