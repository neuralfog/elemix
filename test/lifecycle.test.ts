import { expect, test, describe, beforeEach, vi } from 'vitest';
import { html } from '@neuralfog/elemix-renderer';
import { Present } from '@neuralfog/elemix-testing';
import type { LifeCycle } from './fixtures/LifeCycle';
import type { LifeCycleNoTemplate } from './fixtures/LifeCycleNoTemplate';
import { RenderTrigger } from '../src/types';
import { render } from '../utilities';

import './fixtures/LifeCycle';
import './fixtures/LifeCycleNoTemplate';

describe('Lifecycle Methods', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('onMount with template', async () => {
        const presenter = new Present().screen(html`<life-cycle />`);
        const lifeCycle = presenter.root<LifeCycle>();

        const onRender = vi.spyOn(lifeCycle, 'onRender');
        const onMount = vi.spyOn(lifeCycle, 'onMount');

        await render();

        expect(onRender).toHaveBeenCalledOnce();
        expect(onRender).toHaveBeenCalledWith([RenderTrigger.ON_MOUNT]);
        expect(onMount).toHaveBeenCalledOnce();
        expect(onMount).toHaveBeenCalledWith();
    });

    test('onMount without template', async () => {
        const presenter = new Present().screen(
            html`<life-cycle-no-template />`,
        );
        const lifeCycle = presenter.root<LifeCycleNoTemplate>();

        const onRender = vi.spyOn(lifeCycle, 'onRender');
        const onMount = vi.spyOn(lifeCycle, 'onMount');

        await render();

        expect(onRender).toHaveBeenCalledTimes(0);
        expect(onMount).toHaveBeenCalledTimes(0);
    });

    test('onDispose', async () => {
        const presenter = new Present().screen(html`<life-cycle />`);
        const lifeCycle = presenter.root<LifeCycle>();

        const onDispose = vi.spyOn(lifeCycle, 'onDispose');

        await render();

        presenter.root<LifeCycle>().remove();
        expect(onDispose).toHaveBeenCalledOnce();
    });
});
