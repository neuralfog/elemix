import type { Decorator } from '@storybook/web-components-vite';
import { render, type HtmlTemplate } from '@neuralfog/elemix/render';
import type { ElemixParams, ElemixTeardown } from '#src/elemixStory';

const setupTeardowns = new Map<string, ElemixTeardown | undefined>();

export const elemixDecorator: Decorator = (Story, context) => {
    type CtxArgs = typeof context.args;

    const params = (context.parameters?.elemix ?? {}) as ElemixParams<CtxArgs>;

    if (params.setup && !setupTeardowns.has(context.id)) {
        const teardown = params.setup(context);
        setupTeardowns.set(context.id, teardown);
    }

    const host = document.createElement('div');
    host.setAttribute('data-elemix-root', '');

    const root = document.getElementById('storybook-root') ?? document.body;
    root.innerHTML = '';
    root.appendChild(host);

    params.beforeRender?.(context);

    const template = Story(context) as unknown as HtmlTemplate;
    render(template, host);

    params.afterRender?.(context);

    return host;
};
