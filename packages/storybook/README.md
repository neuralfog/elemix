# ⚡ Elemix Storybook

Storybook integration for [Elemix](https://github.com/neuralfog/elemix). Renders elemix templates directly inside Storybook's web-components framework via a decorator, and provides typed helpers (`ElemixMeta`, `ElemixStory`) for writing stories with full TypeScript support.

## Why?

`@storybook/web-components-vite` ships with a lit-html based renderer. Elemix uses its own renderer (`@neuralfog/elemix-renderer`) and a custom-element lifecycle that lit-html can't drive. This package bridges the two — Storybook keeps managing the UI shell, args panel, addons, and HMR, while elemix owns what actually mounts into the story canvas.

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

The decorator clears `#storybook-root`, mounts a fresh `<div data-elemix-root>` host, and pipes the story's returned template through `render()` from `@neuralfog/elemix-renderer`.

## Writing a Story

```typescript
import { html } from '@neuralfog/elemix';
import type { ElemixMeta, ElemixStory } from '@neuralfog/elemix-storybook';

type HelloArgs = { text: string };

const meta: ElemixMeta<HelloArgs> = {
    title: 'Test/Hello',
    args: { text: 'There' },
    argTypes: { text: { control: 'text' } },
};

export default meta;

export const Default: ElemixStory<HelloArgs> = {
    render: (args) => html`<div>Hello ${args.text}</div>`,
};
```

`ElemixStory.render` returns an elemix `HtmlTemplate` directly — no need to wrap or unwrap. The decorator picks it up and renders it via elemix-renderer.

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
