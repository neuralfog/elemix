import { expect, test, describe, beforeEach, vi } from 'vitest';
import { html } from '../src/renderer/render';
import { present } from '../testing';
import type { LifeCycle } from './fixtures/LifeCycle';
import type { LifeCycleNoTemplate } from './fixtures/LifeCycleNoTemplate';
import { render } from '../utilities';

import './fixtures/LifeCycle';
import './fixtures/LifeCycleNoTemplate';

describe('Lifecycle Methods', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('onMount with template', async () => {
        const presenter = present().screen(html`<life-cycle></life-cycle>`);
        const lifeCycle = presenter.root<LifeCycle>();

        const onMount = vi.spyOn(lifeCycle, 'onMount');

        await render();

        expect(onMount).toHaveBeenCalledOnce();
        expect(onMount).toHaveBeenCalledWith();
    });

    test('onMount without template', async () => {
        const presenter = present().screen(
            html`<life-cycle-no-template></life-cycle-no-template>`,
        );
        const lifeCycle = presenter.root<LifeCycleNoTemplate>();

        const onMount = vi.spyOn(lifeCycle, 'onMount');

        await render();

        expect(onMount).toHaveBeenCalledTimes(0);
    });

    test('onDispose', async () => {
        const presenter = present().screen(html`<life-cycle></life-cycle>`);
        const lifeCycle = presenter.root<LifeCycle>();

        const onDispose = vi.spyOn(lifeCycle, 'onDispose');

        await render();

        presenter.root<LifeCycle>().remove();
        expect(onDispose).toHaveBeenCalledOnce();
    });
});
