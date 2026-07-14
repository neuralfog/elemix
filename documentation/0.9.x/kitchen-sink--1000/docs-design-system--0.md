# Docs Design System

This page renders every element the docs can produce, so we have one place to
style them all. It is a plain reference — not real documentation.

Intro paragraph with a mix of inline styles: **bold text**, *italic text*,
***bold italic***, ~~strikethrough~~, `inline code`, and a [link to the
introduction](/docs/0.9.0/getting-started/introduction). A bare autolink such as
https://elemix.dev is turned into a link too.

## Heading level 2

Paragraph after an H2. Lorem ipsum dolor sit amet, consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Heading level 3

Paragraph after an H3 with more inline `code` and a footnote-style reference to
`@neuralfog/elemix`.

#### Heading level 4

##### Heading level 5

###### Heading level 6

## Text and emphasis

A longer paragraph to check line height and measure. Elemix is a compiler-first
library for building Reactive Elements — standards-based Custom Elements compiled
ahead of time to direct DOM operations. There is **no virtual DOM** and *no
runtime template interpreter*; you author components with `tpl` views and a small
set of compiler hints.

## Blockquote

> A single-line blockquote.

> A blockquote with **bold**, `code`, and a [link](/docs).
>
> > And a nested blockquote inside it.

## Alerts

Callouts are written as a blockquote whose first line is a `[!TYPE]` marker. An
optional title follows the marker; leave it off to use the type's default label.

> [!SUCCESS] Compiled clean
>
> The component compiled with **no diagnostics** and every binding lowered to a
> direct DOM operation.

> [!INFO]
>
> `#state` marks reactive data. Read it in a `template` and the compiler wires up
> the fine-grained update for you.

> [!WARNING] Registration is a side effect
>
> A `#component` only registers when its module loads. Import the module wherever
> the element is used, or `<user-card>` renders nothing.

> [!DANGER] This throws
>
> Tagging a function with `#state` is invalid - state is reactive *data*, never
> behaviour. The analyzer flags it before it ever runs.

## Lists

Unordered:

- First item
- Second item with `inline code`
- Third item
    - Nested item one
    - Nested item two
        - Deeply nested item
- Fourth item

Ordered:

1. Install the runtime
2. Add the Vite plugin
3. Write a component
    1. Give it a tag
    2. Add reactive state

Task list:

- [x] Compiler-first custom elements
- [x] Deep proxy reactivity
- [ ] World domination

## Table

| Hint         | Applies to   | Effect                          |
| ------------ | ------------ | ------------------------------- |
| `#component` | class        | Register as a custom element    |
| `#tag`       | class        | Set the custom element tag name |
| `#state`     | field/export | Mark reactive state             |
| `#styles`    | field        | Adopt component styles          |
| `#effect`    | member       | Re-run when read state changes  |

## Inline code and keyboard

Use `pnpm dev` to start the watcher. The `template` field returns a `tpl` view.

## Code blocks

An `elemix` component:

```elemix
import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import css from './MyComponent.scss?inline';

// #component #tag my-component
export class MyComponent extends Component {
    // #styles
    styles = css;

    // #state
    count = 0;

    inc = (): void => {
        this.count++;
    };

    template = (): Template => tpl`
        <button @click=${this.inc}>
            count is ${this.count}
        </button>
    `;
}
```

The matching `scss`:

```scss
button {
    font: 600 0.95rem 'Space Grotesk', system-ui, sans-serif;
    color: #fff;
    padding: 0.7rem 1.3rem;
    border: 0;
    border-radius: 9px;
    background: linear-gradient(120deg, #4ca8ff, #1e4fd8);

    &:hover {
        filter: brightness(1.06);
    }
}
```

A stylesheet in `css`:

```css
button {
    font: 600 0.95rem 'Space Grotesk', system-ui, sans-serif;
    color: #fff;
    padding: 0.7rem 1.3rem;
    border-radius: 9px;
    background: linear-gradient(120deg, #4ca8ff, #1e4fd8);
}

button:hover {
    filter: brightness(1.06);
}
```

A page using the element, in `html`:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Counter</title>
    </head>
    <body>
        <my-counter></my-counter>
        <script type="module" src="/main.js"></script>
    </body>
</html>
```

Plain `ts`:

```ts
import { defineConfig } from 'vite';
import { elemix } from '@neuralfog/elemix-vite';

export default defineConfig({
    plugins: [elemix()],
});
```

A shell snippet:

```sh
npm i @neuralfog/elemix
npm i -D @neuralfog/elemix-vite
```

A fenced block with no language:

```
just some
plain preformatted text
```

## Image

![elemix logo](/assets/img/logo.svg)

## Horizontal rule

---

That's everything. If it renders here, it renders in the docs.
