# ARCH

### Glossary

- `ec` — elemix compiler (this crate; the first pass).
- `tsc` — the TypeScript compiler (the second pass). `ec` emits `.ts`; `tsc` lowers it to `.js`.

Oxc already gives us a battle-tested JS/TS frontend (lex + parse + AST + spans + scopes). So we don't build a frontend or a backend - no IR optimizer, no codegen passes, no symbol tables we don't get for free. We bolt one small thing onto oxc (a mini HTML parser for the template body) and one small thing onto the output (a string/AST emitter). Everything in between is thin.

.ts source
  │ oxc parse  ── AST + spans + (later) oxc_semantic
  ▼
[1] locate     find tpl`` tagged templates           ← DONE
  │            → per template: { statics: [&str], holes: [Expr] }
  ▼
[2] htmlparse  concat statics w/ markers → node tree
  │            → assign each binding-bearing node a PATH from root
  │            → each hole gets a Slot (Text | Attr(name) | Child)
  ▼
[3] classify   GRAMMAR: (Slot × sigil × value-shape) → BindingKind   ← grammar lives here
  │            → IR: Template { markup, bindings: Vec<Binding> }
  ▼
[4] codegen    walk bindings, call the EMITTER                        ← runtime interface lives here
  │            → `clone(tpl)` + node grabs + `_text(n,()=>expr)` …
  ▼
[5] rewrite    splice generated view() + const template(...) back in
  ▼
emit .ts  ── then tsc → js

### Templates set attributes only

Anything written in a template is an **attribute**. A bare `name=${expr}` always lowers to
`_attr(node, "name", () => expr)` (setAttribute; booleans handled as `true`→`""`, `false`→remove).
We do NOT expose setting non-attribute DOM properties from templates - no `.prop`, no property/
attribute classification, no escape-hatch sigil. One binding for `name=${}`, zero ambiguity.

If a live DOM *property* must be set (the cases where the attribute can't express live state -
`value`, `checked`, `selected`, `indeterminate`, ...), that is an imperative concern:
- two-way form state → `~model` (which sets the property internally), or
- grab a `:ref` and set `this.el.whatever = x` in code.

Consequence: the grammar's attribute axis collapses to a single primitive. There is no `_set`.
Sigils still carve out the genuinely-different ops: `@event` → `_event`, `:prop` → `_prop`
(component props, not DOM), `:ref` → `_ref`, `~model`/`~onmodel` → `_model`/`_onmodel`,
`class=` → `_class`, `style=` → `_style`. Everything else bare → `_attr`.