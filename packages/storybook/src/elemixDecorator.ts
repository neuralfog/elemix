import type { Decorator } from '@storybook/html-vite';
import type { ElemixParams } from '#src/elemixStory';

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
