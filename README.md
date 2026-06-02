# ⚡ Elemix

Reactive elements based on Custom Elements.

This is a personal project built for my own use. It is not open source and comes with no guarantees, warranties, or support.

## Why?

Because I can. The goal is a lean approach that utilizes as much of the native web platform as possible, with absolute freedom in how the application is architected by the implementer.

## Reactivity

There is no virtual DOM. Rendering is handled by [elemix-renderer](https://github.com/neuralfog/elemix-renderer) which performs direct DOM mutations. Elemix uses a pub/sub model built on JS proxies. State objects are wrapped in a `Proxy` that intercepts property mutations. When a value is set, the proxy notifies all subscribed components, triggering a re-render. Nested objects are lazily wrapped in proxies on access, so deep mutations are also reactive. Components subscribe automatically when using `@state()` or `signals`.

Render scheduling is batched via `setTimeout(0)` — multiple state mutations in the same synchronous frame are coalesced into a single render. Once a render is scheduled, further mutations are locked until the next microtask, preventing redundant DOM updates.

Collections (`Map`, `Set`, `WeakMap`, `WeakSet`) are not supported in reactive state.

## Init

```typescript
import { initApp } from '@neuralfog/elemix/app';
import { makeCssStylesheet } from '@neuralfog/elemix/utilities';

import reset from './styles/reset.scss?inline';

initApp({
    baseStyles: [makeCssStylesheet(reset)],
    entryPoint: () => import('./components/MainApp'),
});
```

## Hello World Component

```typescript
import { Component } from '@neuralfog/elemix';
import { component } from '@neuralfog/elemix/decorators';
import { html, type Template } from '@neuralfog/elemix/types';

@component()
export class HelloWorld extends Component {
    template = (): Template => {
        return html`<h1>Hello World!</h1>`;
    };
}
```

## Styles

```typescript
import { Component, html, type Template } from '@neuralfog/elemix';
import { component } from '@neuralfog/elemix/decorators';

import css from './HelloWorld.scss?inline';

@component({ styles: [css] })
export class HelloWorld extends Component {
    template(): Template {
        return html`<h1>Hello World!</h1>`;
    }
}
```

## Cloak

Every component is created with a `data-cloak` attribute that is removed automatically once the first render completes. Use it to prevent flash of unrendered content — hide components in global CSS until they're ready:

```css
[data-cloak] {
    visibility: hidden;
}
```

Once the component mounts and finishes its first render, `data-cloak` is dropped and the element becomes visible.

## Rendering

Renders are triggered implicitly by mutating `@state()` properties or subscribed signals. To trigger a render manually, call `this.render()`. This is useful when you want fine control over rendering without reactivity getting in the way.

```typescript
@component()
export class UserCard extends Component {
    private name = 'John';

    updateName(name: string): void {
        this.name = name;
        this.render();
    }

    template(): Template {
        return html`<p>${this.name}</p>`;
    }
}
```

## Self-Closing Tags

Custom elements and other non-void HTML elements can be written in self-closing form. The renderer expands `<my-tag />` to `<my-tag></my-tag>` before parsing, so you can drop the redundant closing tag whenever the element has no children.

```typescript
template(): Template {
    return html`
        <pf-icon-search />
        <pf-divider />
        <pf-card data-variant="primary" />
    `;
}
```

Void HTML elements (`br`, `hr`, `img`, `input`, `link`, `meta`, etc.) are left alone — they're already self-closing per the HTML spec.

## Props

Primitive props are shallow-diffed and only trigger updates when the value changes. Object props are passed through reactively. Functions are assigned once.

```typescript
import { Component, html, type Template } from '@neuralfog/elemix';
import { component } from '@neuralfog/elemix/decorators';

type Props = {
    name: string;
    age: number;
    handler: () => void;
    meta: { role: string; active: boolean };
};

@component()
export class UserCard extends Component<Props> {
    template(): Template {
        const { name, age, handler, meta } = this.props;

        return html`<div>
            <p>${name}</p>
            <p>${age}</p>
            <p>${meta.role}</p>
            <button @click=${handler}>Click</button>
        </div>`;
    }
}
```

```typescript
html`<user-card
    :name=${'John'}
    :age=${25}
    :handler=${() => console.log('clicked')}
    :meta=${{ role: 'admin', active: true }}
/>`;
```

Object props can be freely mutated — proxies retain reactivity and trigger updates for all subscribed components.

## State

Local state is managed via the `@state()` decorator. Mutating any property on the state object will automatically trigger a re-render.

```typescript
import { Component, html, type Template } from '@neuralfog/elemix';
import { component, state } from '@neuralfog/elemix/decorators';

@component()
export class UserProfile extends Component {
    @state()
    state = { name: 'John', email: 'john@example.com', active: true };

    template(): Template {
        const { name, email, active } = this.state;

        return html`<div>
            <p>${name}</p>
            <p>${email}</p>
            <p>${active ? 'Online' : 'Offline'}</p>
        </div>`;
    }
}
```

## Events

Use the `@` prefix to bind native DOM events directly in templates.

```typescript
@component()
export class Counter extends Component {
    @state()
    state = { count: 0 };

    template(): Template {
        return html`<div>
            <p>${this.state.count}</p>
            <button @click=${() => this.state.count++}>Increment</button>
            <input @input=${(e: Event) => console.log((e.target as HTMLInputElement).value)} />
        </div>`;
    }
}
```

## Model Binding

Use the `~model` prefix for two-way binding on input elements. The bound value must be an object with a `value` property.

```typescript
@component()
export class SearchBox extends Component {
    @state()
    state = { query: { value: '' } };

    template(): Template {
        const { query } = this.state;

        return html`<div>
            <input ~model=${query} />
            <p>${query.value}</p>
        </div>`;
    }
}
```

## Ref

The `ref` helper creates a `{ value }` wrapper. Use `:ref` to capture a DOM element reference, or pass it to `~model` for two-way binding.

```typescript
import { Component, html, type Template } from '@neuralfog/elemix';
import { component, state } from '@neuralfog/elemix/decorators';
import { ref } from '@neuralfog/elemix/utilities';

@component()
export class Form extends Component {
    @state()
    input = ref('');
    heading = ref<HTMLHeadingElement>();

    template(): Template {
        return html`<div>
            <h1 :ref=${this.heading}>Title</h1>
            <input ~model=${this.input} />
            <p>${this.input.value}</p>
        </div>`;
    }
}
```

## Signals

Signals are reactive stores shared across components. Read a signal's value inside a component's `template()` and the component re-renders whenever that signal changes — **no manual subscription needed**.

Subscription is fully automatic: while `template()` runs, every `signal.value.x` access tells the framework "this component depends on this signal." After the render, the component is subscribed to every signal it actually read. On the next render, stale subscriptions are dropped and current ones re-tracked, so conditional reads stay correct and nothing leaks. When the component leaves the DOM, all of its signal subscriptions are cleaned up automatically.

You don't register signals anywhere. You just read them.

### Definition

```typescript
import { signal } from '@neuralfog/elemix/signal';

export const counter = signal({
    count: 0,
    label: 'Clicks',
});
```

### Usage

```typescript
import { Component, html, type Template } from '@neuralfog/elemix';
import { component } from '@neuralfog/elemix/decorators';

import { counter } from '../signals/counter';

@component()
export class CounterDisplay extends Component {
    template(): Template {
        const { count, label } = counter.value;

        return html`<div>
            <p>${label}: ${count}</p>
            <button @click=${() => counter.value.count++}>Increment</button>
        </div>`;
    }
}
```

## Lifecycle Hooks

Components support four lifecycle hooks: `beforeMount`, `onMount`, `onRender`, and `onDispose`.

```typescript
@component()
export class Dashboard extends Component {
    beforeMount(): void {
        // Called before initialization
    }

    onMount(): void {
        // Called after first render
    }

    onRender(renderTriggers?: string[]): void {
        // Called after each render with triggers that caused the update
    }

    onDispose(): void {
        // Called when component is removed from DOM
    }

    template(): Template {
        return html`<div>Dashboard</div>`;
    }
}
```

## Conditionals

Use ternary expressions in templates.

```typescript
html`${isActive ? html`<p>Active</p>` : html`<p>Inactive</p>`}`;
```

## Repeat

Use the `repeat` directive to render lists. Pass an optional key function for efficient diffing.

```typescript
import { repeat } from '@neuralfog/elemix/directives';

@component()
export class UserList extends Component {
    @state()
    state = {
        users: [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
        ],
    };

    template(): Template {
        const { users } = this.state;

        return html`<ul>
            ${repeat(
                users,
                (user) => html`<li>${user.name}</li>`,
                (user) => user.id,
            )}
        </ul>`;
    }
}
```

## Direct Property Assignment

Use the `.` prefix to set properties directly on HTML elements.

```typescript
html`<input .value=${'Hello'} />`;

html`<div .textContent=${'Updated text'} />`;
```

## Dynamic Classes

Use the `.class` prefix to bind classes dynamically. Accepts a string or an object mapping class names to booleans.

```typescript
html`<div .class=${'active highlight'}>String</div>`;

html`<div .class=${{ active: isActive, disabled: isDisabled }}>Object</div>`;
```

## Bind Attributes

Use `.bind-attrs` to dynamically set multiple attributes from an object.

```typescript
html`<div .bind-attrs=${{ 'data-id': '123', 'aria-label': 'Card' }}>Content</div>`;
```

## Bind Events

Use `.bind-events` to dynamically attach multiple event handlers from an object.

```typescript
html`<div .bind-events=${{ click: onClick, input: onInput }}>Content</div>`;
```
