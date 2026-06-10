# ⚡ Elemix ⚠️ **Compiled Experimental**

Reactive elements (CustomElements).

This is a personal project built for my own use. It is not open source and comes with no guarantees, warranties, or support.

## Why?

Because I can. The goal is a lean approach that utilizes as much of the native web platform as possible, with absolute freedom in how the application is architected by the implementer.

## Compile-only

There is no virtual DOM and no runtime template interpreter. Components are authored with `tpl` tagged-template views, and a compiler (Rust + oxc) lowers each template ahead of time into direct DOM construction wired to a small set of runtime primitives. Nothing parses, walks, or diffs a template in the browser — the per-component hot path is plain `cloneNode` + direct node references + direct subscriptions.

What ships is small (~2.6 kB gzip): the reactive core plus the DOM-wiring primitives the compiler targets. The expensive work — parsing, hole classification, codegen — happens at build time, not at runtime.

## Reactivity

Reactivity is fine-grained and signal-style. Reading reactive state inside a binding subscribes that binding to exactly the cells it touched; mutating a cell re-runs only the bindings that read it — never the whole tree.

Updates are synchronous: a state mutation re-runs its dependent bindings immediately, so the DOM is current on the next line.

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
- [When / Choose](https://playground.elemix.dev/#when-choose)
- [Lifecycle](https://playground.elemix.dev/#lifecycle)
- [Refs](https://playground.elemix.dev/#refs)
- [Slots](https://playground.elemix.dev/#slots)
- [Nested Lists](https://playground.elemix.dev/#nested-lists)
- [Form Control](https://playground.elemix.dev/#form-associated)
