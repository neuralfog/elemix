# ⚡ Elemix

Reactive elements based on Custom Elements.

This is a personal project built for my own use. It is not open source and comes with no guarantees, warranties, or support.

## Why?

Because I can. The goal is a lean approach that utilizes as much of the native web platform as possible, with absolute freedom in how the application is architected by the implementer.

## Reactivity

There is no virtual DOM. The renderer performs direct DOM mutations via tagged template literals and hole-based diffing. Elemix uses a pub/sub model built on JS proxies. State objects are wrapped in a `Proxy` that intercepts property mutations. When a value is set, the proxy notifies all subscribed components, triggering a re-render. Nested objects are lazily wrapped in proxies on access, so deep mutations are also reactive. Components subscribe automatically when using `state()` or `signals`.

Render scheduling is batched via `setTimeout(0)` — multiple state mutations in the same synchronous frame are coalesced into a single render. Once a render is scheduled, further mutations are locked until the next microtask, preventing redundant DOM updates.

Collections (`Map`, `Set`, `WeakMap`, `WeakSet`) are not supported in reactive state.

## Examples

Every feature has a live, editable example in the playground — **[playground.elemix.dev](https://playground.elemix.dev/)**:

- [Counter](https://playground.elemix.dev/#counter)
- [Todo App](https://playground.elemix.dev/#todo)
- [Two-Way Binding](https://playground.elemix.dev/#two-way-binding)
- [Props](https://playground.elemix.dev/#props)
- [State in Props](https://playground.elemix.dev/#state-in-props)
- [Signals](https://playground.elemix.dev/#signals)
- [onMutation](https://playground.elemix.dev/#on-mutation)
- [render()](https://playground.elemix.dev/#render)
- [Direct Bindings](https://playground.elemix.dev/#direct-bindings)
- [Conditionals](https://playground.elemix.dev/#conditionals)
- [Lifecycle](https://playground.elemix.dev/#lifecycle)
- [Refs](https://playground.elemix.dev/#refs)
- [Slots](https://playground.elemix.dev/#slots)
- [Nested Lists](https://playground.elemix.dev/#nested-lists)
- [Form Control](https://playground.elemix.dev/#form-associated)
