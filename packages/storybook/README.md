<img src="https://raw.githubusercontent.com/neuralfog/elemix/main/.readme/elemix-banner.svg" alt="elemix - Reactive Elements" width="100%" />

# Elemix Storybook Integration

Storybook integration for [elemix](https://www.npmjs.com/package/@neuralfog/elemix): a decorator that mounts elemix components into the story canvas, plus typed story helpers. Runs on `@storybook/html-vite`.

Use with [@neuralfog/elemix-testing-library](https://www.npmjs.com/package/@neuralfog/elemix-testing-library) for any testing needs.

```bash
pnpm add -D @neuralfog/elemix-testing-library
```

## Installation

```bash
pnpm add -D @neuralfog/elemix-storybook @neuralfog/elemix-vite @storybook/html-vite
```

Add the elemix Vite plugin in `.storybook/main.ts`:

```ts
import { elemix } from '@neuralfog/elemix-vite';
import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.ts'],
    framework: '@storybook/html-vite',
    viteFinal: (cfg) => {
        cfg.plugins = [...(cfg.plugins ?? []), elemix()];
        return cfg;
    },
};

export default config;
```

Register the decorator in `.storybook/preview.ts`:

```ts
import { elemixDecorator } from '@neuralfog/elemix-storybook';
import type { Preview } from '@storybook/html-vite';

const preview: Preview = {
    decorators: [elemixDecorator],
};

export default preview;
```
