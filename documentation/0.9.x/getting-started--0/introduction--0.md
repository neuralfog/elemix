# Introduction

elemix is a compiler-first library for building Reactive Elements — standards-based
Custom Elements compiled ahead of time to direct DOM operations.

There is no virtual DOM and no runtime template interpreter. You author components
with `tpl` tagged-template views and a small set of compiler hints; the Rust
compiler lowers each template into direct DOM construction wired to a tiny runtime.

## Why elemix

- **Small runtime** — a few kilobytes, gzipped, with zero runtime dependencies.
- **Fast** — a first paint on par with hand-written vanilla JavaScript.
- **Native** — your components are Custom Elements, first-class citizens of the browser.
- **Ergonomic** — deep, proxy-driven reactivity with no `.value` and no refs.

Head to [Installation](/docs/0.9.0/getting-started/installation) to get started.
