import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|tsx)'],
    addons: ['@storybook/addon-vitest'],
    framework: '@storybook/web-components-vite',
};

export default config;
