// Silence the "Lit is in dev mode" banner that addon-vitest's web-components
// preset emits during test runs. Elemix doesn't use Lit, but Storybook's
// `@storybook/web-components-vite` framework still pulls lit-html in as a
// transitive dep for its own rendering, so the warning surfaces in stderr.
import './silence-lit';

import type { Preview } from '@storybook/web-components-vite';
import { elemixDecorator } from '../src/elemixDecorator';

const preview: Preview = {
    decorators: [elemixDecorator],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },

        onboarding: false,
    },
};

export default preview;
