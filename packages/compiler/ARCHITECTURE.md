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
[B] pragma    expand `// #` comment pragmas: tag a class (#component/#tag/      ← pragma/
  │           #form) or a member (#styles/#state/#effect) → defineComponent,
  │           sheets, state()/effect() wiring. Identity if no pragmas. (↓↓)
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

### Pragmas — comment macros (`pragma/`)

A **pragma** is a `//` line comment that tags the declaration on the *immediately following* line (no
blank between). It replaces hand-written `defineComponent`, `static styles`/`formAssociated`,
`state(…)` calls, and effect wiring:

```ts
const css = `:host { … }`;

// #component #tag user-card
export class UserCard extends Component {
  // #styles
  styles = css;                 // → const _s0 = sheet(css); UserCard.__sheets = [..._s0]; (field stripped)
  // #state
  state: State = { n: 0 };      // → state = state<State>({ n: 0 })
  // #effect
  sync(): void { … }            // → effects() { effect(() => this.sync()); }
}
```

**Marker ≠ value.** A pragma only *marks*; the real declaration *carries* the value, so it stays an
expression `tsc` checks — and the same `//` comment works byte-identically in `.ts` and `.js` (no
import, no annotation, no decorator runtime). That is *why* pragmas are comments and not string
literals (illegal above a class member) or decorators (class-only, need typed stub imports, re-couple
to decorator-aware tooling). The design rule still holds: **generic parsing is decoupled from
directive meaning** — a new class-level directive is one `ComponentMeta` field + one `resolve` arm;
`parse.rs` never changes.

- **parse.rs** — a pragma comment's text → `Vec<Directive>{name, args}`, split on `#`. Pure text, no
  interpolation (values live in the declaration), no oxc.
- **locate.rs** — walk `program.comments`; bind each `//` pragma to the nearest declaration on the
  next line (whitespace-only gap, exactly one newline — a blank line breaks it → *orphan*). Targets:
  a **class** (`#component`/`#tag`/`#form`), a **field** (`#styles`/`#state`/`#effect`), a **method**
  (`#effect`), or a module **const** (`#state`). Records the spans + class-body-open offset `lower`
  needs, plus the per-`#state` rewrite and per-class effect names.
- **mod.rs::resolve** — the extension point for class directives → `ComponentMeta`
  (`register`/`tag`/`form`); `#styles`/`#state`/`#effect` on a class error here. `kebab(class_name)`
  derives the tag when `#tag` is absent.
- **lower.rs** — strip every pragma comment, then apply per the table below; emit the runtime import
  for exactly what was used.

Directives (closed set):

| directive | tags | lowers to |
|---|---|---|
| `#component` | class | `defineComponent('<tag>', Class)` |
| `#tag <name>` | class | explicit tag; else `PascalCase → kebab` |
| `#form` | class | `static formAssociated = true` injected in the body |
| `#styles` | class field | inline the field value into `const _sN = sheet(<value>)` + `Class.__sheets`; strip the field |
| `#state` | field / module `const` | wrap the initializer: `name: T = init` → `name = state<T>(init)` (annotation → generic) |
| `#effect` | method / arrow field | a generated `effects() { effect(() => this.m()); … }` hook (one per tag, multiple allowed) |

`#styles` MUST tag a class *field* (a module `const` referenced only by a comment trips
`noUnusedLocals`); the idiom keeps the css module-scope and reassigns it onto the instance
(`styles = css`). `#state`/`#effect` resolve `state`/`effect` from `@neuralfog/elemix/runtime`
(compile targets merged into the runtime import) — neither is on the public barrel, so users never
call them by hand.

Tag *validity* is **not** checked — `customElements.define` is the canonical validator and throws at
registration. Errors surface as a leading `// [ec] pragma error: …` comment, never a panic — the wasm
playground must survive half-typed input.

Runtime targets in `@neuralfog/elemix/runtime`: `sheet()` (content-cached `CSSStyleSheet[]`),
`defineComponent`, `state`, `effect`, and the base `Component` — `__sheets`/`adoptStyles()` (styles),
`ctor.formAssociated` + `internals` (form), and the generated `effects()` hook the base runs at mount
inside its own `collect()`, owning effect scopes in a **separate** list disposed on disconnect but
never re-run by `render()`. `Component.isMounted` (false during the mount effect run, true after) lets
a `#effect` skip its mount-time action with an early return.
