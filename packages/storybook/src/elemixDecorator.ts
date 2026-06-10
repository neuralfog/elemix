import type { Decorator } from '@storybook/web-components-vite';
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

    const result = Story(context) as unknown as string | Node;
    if (typeof result === 'string') {
        host.innerHTML = result;
    } else {
        host.appendChild(result);
    }

    params.afterRender?.(context);

    return host;
};
