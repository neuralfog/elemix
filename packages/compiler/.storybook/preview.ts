import type { Decorator, Preview } from '@storybook/html-vite';

const mount: Decorator = (Story, context) => {
    const host = document.createElement('div');
    host.setAttribute('data-elemix-root', '');

    const root = context.canvasElement;
    root.innerHTML = '';
    root.appendChild(host);

    const result = Story(context) as unknown as string | Node;
    if (typeof result === 'string') host.innerHTML = result;
    else host.appendChild(result);

    return host;
};

const preview: Preview = {
    decorators: [mount],
    parameters: { onboarding: false },
};

export default preview;
