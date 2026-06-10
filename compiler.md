The pipeline (5 stages)

1. Locate templates in source. Walk each .ts file, find every html`...` tagged template + its ${} holes. ← this is the foundational hard part. You need a JS/TS lexer robust enough to know you're in code vs string vs comment vs template, track nested html`...${html`...`}...`, and delimit each ${} expression by brace-matching. You do not need a full typechecker — the ${} expressions are opaque slices you capture and re-emit verbatim. It's the same lexing-robustness problem that bit us stripping comments, just bigger. → Look at esbuild's lexer (Go) as the reference.
2. Parse the template's HTML (per template, at compile time — what the runtime prepare does now). Concatenate the static strings with placeholders, parse to a node tree (golang.org/x/net/html, or a lean purpose-built one), and for each hole record: its kind (attr / :prop / @event / child-content) and a stable path to its node.
3. Analyze + classify — this is where you beat the runtime, because you have static structure:
  - text/primitive child holes → emit a text node directly, no comment marker (stage 1, done safely with static knowledge).
  - genuinely dynamic holes (lists/nested templates) → emit an anchor only where needed.
  - fully-static subtrees → clone as one chunk.
4. Codegen. Emit imperative JS per template: build the DOM (a cached template.cloneNode skeleton + grab hole nodes by direct path, no runtime TreeWalker, no holes Map), then wire each hole to a runtime primitive. Plus source maps back to the original  html `` (don't skip this — it's the DX difference between usable and hated).
5. A tiny runtime the codegen targets: _text(node, get), _attr(el, name, get), _event(el, name, fn), _child(anchor, get), _list(...). The compiled output is just calls into these, and these are what subscribe into your existing Reactive/read-tracking. Design this runtime API first — it's the contract between compiler and runtime, and everything else is downstream of it.

Decisions to lock early
- Runtime API surface (stage 5) — design before codegen.
- clone-vs-createElement for DOM construction — measure; clone usually wins for non-trivial templates.
- Keep the runtime  html `` path alongside compiled output (Lit model) so dev/playground still work uncompiled and compiled is the prod optimization — or go compile-only. Pick deliberately.

Prior art to read (in priority order)
- Solid's babel-plugin-jsx-dom-expressions + solid-js/web runtime — this is your model: compile templates → clone + tiny fine-grained runtime primitives. Read its output and its primitive list; you're building the tagged-template equivalent.
- @lit-labs/compiler — the "compile the tagged template, keep the runtime" precedent, closest to elemix's  html `` shape.
- esbuild — for the Go lexer approach and the Go→WASM playground path.

The honest scope flag: stage 1 (the lexer that finds templates) is 60% of the work and the riskiest — get a tagged-template + ${} + nesting locator rock-solid first, because every other stage is downstream of it. Build that, throw a corpus of real elemix components at it, and only then move to HTML parsing + codegen.

Want me to sketch the runtime-primitive API (stage 5) next? That's the keystone, and it's the part that has to mesh with your existing reactivity.