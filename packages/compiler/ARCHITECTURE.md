# ARCH

### Glossary

- `ec` — elemix compiler (this crate; the first pass).
- `tsc` — the TypeScript compiler (the second pass). `ec` emits `.ts`; `tsc` lowers it to `.js`.

Oxc already gives us a battle-tested JS/TS frontend (lex + parse + AST + spans + scopes). So we don't build a frontend or a backend - no IR optimizer, no codegen passes, no symbol tables we don't get for free. We bolt small things onto oxc (a mini HTML parser for the template body, a `#`-pragma scanner) and one small thing onto the output (a string/AST emitter). Everything in between is thin.

`compile(source)` is four isolated string-rewriting passes over the oxc AST:

```
compile = merge_imports( rewrite( pragma::expand( splice::inline_helpers( source ))))

[A] splice    inline helper templates: ${header} (local const) /              ← splice.rs
  │           ${this.fooTemplate()} (member) fold into their hole, leaving
  │           ONE outermost template. Identity if no helpers.
  ▼
[B] pragma    expand `#`-pragma blocks above a class →                         ← pragma/
  │           defineComponent + hoisted sheet() consts + __sheets + #form's
  │           formAssociated. Identity if no pragmas. (detail ↓↓)
  ▼
[C] rewrite   lower the class's `tpl` template member into a view()            ← rewrite.rs
  │           (the locate→parse→classify→codegen detail below); hoist the
  │           const template(...) consts, wire the /runtime import (only the
  │           primitives used), drop the erased /directives import, strip the
  │           compile-time tpl tag + the now-unused Template type import.
  ▼
[D] merge     fold the compiler's own '@neuralfog/elemix/runtime' imports      ← imports.rs
  │           (pragma's + rewrite's) into one. User imports never touched.
  ▼
emit .ts  ── then tsc → js
```

Template lowering — what `rewrite` [C] does to the `tpl` member:

```
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

### Pragmas — component-level macros (`pragma/`)

A **pragma block** is bare template-literal statement(s) directly above a component class. It
replaces hand-written `defineComponent` calls, `static styles`, and `static formAssociated`:

```ts
`#component #tag pf-builder #styles ${css}`     // one line
export class PfBuilder extends Component { … }

`#component`; `#tag x`; `#styles ${css}`;       // or split across `;`-terminated lines
```

The design rule mirrors the rest of the compiler: **generic parsing is fully decoupled from
directive meaning**, so adding a directive is *one field + one `resolve` arm* and `parse.rs`
never changes.

- **parse.rs** — `(statics, holes) → Vec<Directive>{name, args}`. Splits directives on `#` in the
  *static* text only, so a `#` inside an interpolation (`${'#fff'}`) is opaque (arrives as an
  `Arg::Expr`). Pure, no oxc.
- **locate.rs** — oxc: find pragma statements, group contiguous runs, bind each to the next
  `class` (error: *orphan* if none). Handles `;`-separated statements (buffered) **and**
  no-semicolon multi-line, which JS parses as a *chained* tagged template — flattened here.
  Note: the no-semicolon form is compiler-valid but `tsc` rejects it (`string` isn't callable),
  so source that must typecheck uses the `;`-terminated form. Records the spans `lower` needs
  plus the class-body-open offset (for `#form` injection).
- **mod.rs::resolve** — **the extension point.** Folds directives into a typed `ComponentMeta`
  (`register` / `tag` / `styles` / `form`). Unknown directive or conflicting `#tag` → error.
  `kebab(class_name)` derives the tag when `#tag` is absent.
- **lower.rs** — per block: hoist `const _sN = sheet(<expr>)` (deduped by expression, like the
  template hoister), append `Class.__sheets = [...]` + `defineComponent('<tag>', Class)` after
  the class, inject `static formAssociated = true` into the body for `#form`, strip the pragma
  statements, prepend the `/runtime` import.

Directives (closed set, independent + composable):

| directive | does |
|---|---|
| `#component` | register the class via `defineComponent` |
| `#tag <name>` | explicit tag; else derived `PascalCase → kebab` |
| `#styles ${expr}` | adopt stylesheet(s); accumulates across occurrences |
| `#form` | form-associated element (inject `static formAssociated = true`) |

Tag *validity* (the required hyphen, reserved names) is **not** checked — `customElements.define`
is the canonical validator and throws at registration (`Button → button` fails loudly there), so
the compiler stays thin. Pragma errors surface as a leading `// [ec] pragma error: …` comment,
never a panic — the wasm playground must survive half-typed input.

The runtime targets the pragma lowering emits live in `@neuralfog/elemix/runtime`: `sheet()`
(content-cached `CSSStyleSheet[]`), `defineComponent`, and the base `Component.adoptStyles()` /
static `__sheets` that `connectedCallback` adopts. `#form` relies on the base reading
`ctor.formAssociated` and attaching `internals` (typed non-optional so `#form` components use it
without per-class narrowing).
