# ⚙️ Elemix Compiler ⚠️ **Experimental**

The compiler that makes Elemix compile-only.

This is a personal project built for my own use. It is not open source and comes with no guarantees, warranties, or support.

## Why?

Because the runtime should do as little as possible. Elemix components are authored with `tpl` tagged-template views — this compiler lowers them ahead of time so nothing parses, walks, or diffs a template in the browser.

## What it does

Written in Rust on the [oxc](https://oxc.rs) parser. It rewrites each component's `tpl` template into a `view()` that builds the DOM directly and wires it to the runtime primitives — no template interpreter ships. Directives (`repeat`, `when`, `choose`) are erased at compile time, and the output imports only the primitives it uses.

## Usage

```sh
elemix-compiler --dirs <dir|glob>... --out <dir>
elemix-compiler --file <path>
```
