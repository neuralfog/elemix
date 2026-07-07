import type { Decorator, Preview } from '@storybook/html-vite';

// Mount the story result (a custom-element tag string, or a Node) into a host.
// The compiled component registers itself via the story's side-effect import,
// then upgrades + mounts through its own connectedCallback.
const mount: Decorator = (Story, context) => {
    const host = document.createElement('div');
    host.setAttribute('data-elemix-root', '');

    // Mount into the story's own canvas — this is #storybook-root in the live
    // Storybook UI, but a per-test container under the vitest browser runner.
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
