# ⚡ Elemix Storybook ⚠️ **Compiled Experimental**

Storybook integration for [Elemix](https://github.com/neuralfog/elemix). Mounts compiled elemix custom elements inside Storybook's web-components framework via a decorator, and provides typed helpers (`ElemixMeta`, `ElemixStory`) for writing stories with full TypeScript support.

## Why?

`@storybook/web-components-vite` ships with a lit-html based renderer. Elemix is compile-only — its components are custom elements that lit-html can't drive. This decorator bridges the two: Storybook keeps managing the UI shell, args panel, addons, and HMR, while the decorator mounts whatever the story returns into the story canvas.

## Install

```bash
npm install --save-dev @neuralfog/elemix-storybook
```

## Setup

Register the decorator in `.storybook/preview.ts`:

```typescript
import type { Preview } from '@storybook/web-components-vite';
import { elemixDecorator } from '@neuralfog/elemix-storybook';

const preview: Preview = {
    decorators: [elemixDecorator],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
};

export default preview;
```

The decorator clears `#storybook-root`, mounts a fresh `<div data-elemix-root>` host, and appends the story's returned string or Node into it.

## Writing a Story

A story's `render` returns a string (custom-element markup) or a DOM `Node`. Import the component module for its registration side effect.

```typescript
import type { ElemixMeta, ElemixStory } from '@neuralfog/elemix-storybook';
import './HelloElement'; // registers <hello-element>

type HelloArgs = { text: string };

const meta: ElemixMeta<HelloArgs> = {
    title: 'Test/Hello',
    args: { text: 'There' },
    argTypes: { text: { control: 'text' } },
};

export default meta;

export const Default: ElemixStory<HelloArgs> = {
    render: (args) => `<hello-element name="${args.text}"></hello-element>`,
};
```

## Per-Story Hooks

Stories can opt into setup / teardown / render hooks via `parameters.elemix`:

```typescript
const meta: ElemixMeta<HelloArgs> = {
    title: 'Test/Hello',
    parameters: {
        elemix: {
            setup: (ctx) => {
                return () => {};
            },
            beforeRender: (ctx) => {},
            afterRender: (ctx) => {},
        },
    },
};
```

| Hook | When it runs |
|---|---|
| `setup` | Once per story id, before the first render. May return a teardown function. |
| `beforeRender` | Before every render (initial + every args change). |
| `afterRender` | After every render. |

## Notes

```bash
npx storybook@latest init --type web_components
```

The Storybook wizard does not bootstrap TypeScript on its own, so create `tsconfig.json` before running init.
