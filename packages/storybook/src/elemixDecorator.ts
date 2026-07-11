import type { Decorator } from '@storybook/html-vite';
import type { ElemixParams } from '#src/elemixStory';

// The story is rendered into a detached host that Storybook then mounts into its
// canvas. We deliberately do NOT append the host ourselves: under the Vitest
// runner the canvas is a per-test element, not `#storybook-root`, so pre-mounting
// elsewhere would leave the elemix component connected to the wrong tree - and
// Storybook moving it would disconnect it, tearing down its reactive scopes.
export const elemixDecorator: Decorator = (Story, context) => {
    type CtxArgs = typeof context.args;

    const params = (context.parameters?.elemix ?? {}) as ElemixParams<CtxArgs>;

    const host = document.createElement('div');
    host.setAttribute('data-elemix-root', '');

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
