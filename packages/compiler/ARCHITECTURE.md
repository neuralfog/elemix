# ARCH

### Glossary

- `ec` — elemix compiler (this crate; the first pass).
- `tsc` — the TypeScript compiler (the second pass). `ec` emits `.ts`; `tsc` lowers it to `.js`.

Oxc already gives us a battle-tested JS/TS frontend (lex + parse + AST + spans + scopes). So we don't build a frontend or a backend - no IR optimizer, no codegen passes, no symbol tables we don't get for free. We bolt one small thing onto oxc (a mini HTML parser for the template body) and one small thing onto the output (a string/AST emitter). Everything in between is thin.

`compile(source)` is just `rewrite(inline_helpers(source))` — a Splice pre-pass that folds helper templates into one self-contained template, then the rewrite that compiles it.

```
.ts source
  │
[0] splice     inline helper templates: ${header} (local const) and          ← splice.rs::inline_helpers
  │            ${this.fooTemplate()} (member) get folded into their hole,
  │            leaving exactly ONE outermost template. Identity if no helpers.
  ▼
  │ oxc parse  ── AST + spans
  ▼
[1] locate     find tpl`` tagged templates                                    ← locate.rs
  │            → per template: { statics: [String], holes: [String] }
  ▼
[2] parse      concat statics w/ markers → node tree                          ← template/parse.rs
  │            → assign each binding-bearing node a PATH from root
  │            → each hole gets a Slot (Text | Attr(name) | Content)
  ▼
[3] classify   GRAMMAR: (Slot × sigil × value-shape) → BindingKind            ← grammar.rs
  │            → Binding { path, kind, name, expr, baked }
  ▼
[4] codegen    Phase 1: grab every binding's node WHILE THE CLONE IS          ← codegen.rs
  │            PRISTINE (inserts shift sibling indices, so grab first).
  │            Phase 2: emit each binding via the EMITTER trait.               ← emit/ (runtime interface)
  │            Value writes (text/attr/class/style/prop) collect into ONE
  │            effect per template instance; structural (list/child) and
  │            wiring (event/model/ref) emit as-is.
  │            → clone(_t0) + node grabs + effect(() => { _setText(n, x) … })
  ▼
[5] rewrite    splice the generated view() + hoist the const template(...)     ← rewrite.rs
  │            consts, wire the /runtime import (only the primitives used),
  │            drop the erased /directives import, strip the compile-time
  │            tpl tag + the now-unused Template type import
  ▼
emit .ts  ── then tsc → js
```

Content holes recurse: a nested `` tpl`...` `` inside a directive's argument lowers to an
inline IIFE builder, so `repeat(...)` becomes `_list`, and `when`/`choose`/ternaries become
`_child`. `lower.rs` does the balanced string surgery (split call args, split ternary, find
nested templates) that makes this robust without needing fresh source spans.

### Templates set attributes only

Anything written in a template is an **attribute**. A bare `name=${expr}` always lowers to
`_setAttr(node, "name", (expr))` (setAttribute; booleans handled as `true`→`""`, `false`→remove).
We do NOT expose setting non-attribute DOM properties from templates - no `.prop`, no property/
attribute classification, no generic escape-hatch `_set`. One binding for `name=${}`, zero ambiguity.

If a live DOM *property* must be set (the cases where the attribute can't express live state -
`value`, `checked`, `selected`, `indeterminate`, ...), that is an imperative concern:
- two-way form state → `~model` (which sets the property internally), or
- grab a `:ref` and set `this.el.whatever = x` in code.

Consequence: the grammar's bare-attribute axis collapses to a single primitive. Sigils still
carve out the genuinely-different ops. The runtime primitives the emitter targets:

- **value writes** — collected into ONE `effect` per template instance (a row pays one
  Scope/Set, not one per binding): `_setText`, `_setAttr`, `_setClass`, `_setStyle`, `_setProp`
- **structural content**: `_child`, `_list`
- **wiring** (raw expression, no reactive thunk): `_event`, `_ref`, `_model`, `_onmodel`
- **scaffolding**: `template` (parse markup once, `importNode` to adopt), `clone`, `effect`

Mapping by slot/sigil: bare `name=${}` → `_setAttr`, `class=` → `_setClass`, `style=` → `_setStyle`,
`:prop` → `_setProp` (component props, not DOM), `@event` → `_event`, `:ref` → `_ref`,
`~model`/`~onmodel` → `_model`/`_onmodel`. Content: `${repeat(...)}` → `_list`,
`${cond ? a : b}` / `when` / `choose` / nested `tpl` → `_child`, plain `${x}` → `_setText`.

A bare `${nestedTemplate}` reference (`${header}` / `${this.headerTemplate()}` that survives the
Splice pre-pass) is the one deferred case — syntactically identical to a text value, it needs
symbol resolution to know the referent is a template, so it currently falls through to Text.
