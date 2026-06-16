# ANALYZER

Design note for `ec-analyzer` — elemix's template **prop typechecker**. CLI-only, separate
pass from `ec`. Not built yet; this is the agreed shape. See `ARCHITECTURE.md` for the compiler
it sits next to.

### Glossary

- `ec` — elemix compiler (lowers `tpl` → `view()`). The analyzer does NOT compile; it only checks.
- `ea` — elemix analyzer (this tool). Reads the SAME pre-compile source `ec` does (pragmas + `tpl`).
- `oracle` — the swappable backend that answers one question: *is type A assignable to type B?*

### The job

Catch prop type mismatches across components, at the use site:

```ts
`#component #tag user-card`
export class UserCard extends Component <{ name: string = ''; }>

// elsewhere
tpl`<user-card :name=${42}>`     // ← want an error: number not assignable to string
```

Class → tag is known (`#component #tag`), so resolving `<user-card>` back to `UserCard` is trivial.
The hard part is never the *lookup* — it's the *type judgment*.

### Why bare `tsc` finds nothing

In the source, `<user-card name=${x}>` is an **opaque string** to `tsc`. It types the `${x}` hole as
a standalone expression but has no link to `UserCard['name']`. Running the user's `tsc` over their
project surfaces zero prop errors — there is nothing for it to check.

### The mechanism: synthesize the check, then let `tsc` check IT

`ea` generates a virtual assertion file, one line per prop hole:

```ts
import { UserCard } from './card';
const _c1: UserCard['name'] = (42);   // tsc reports: number not assignable to string — HERE
```

`tsc` reports the mismatch on the synthetic line; `ea` maps that diagnostic back to the original
template span. The synthetic `const _c: T = expr` uses only fully-public, stable TS API
(`createProgram` + `getSemanticDiagnostics`). It deliberately avoids `checker.isTypeAssignableTo`,
which is internal and unstable.

### Pipeline

```
ea(project) — three stages, brains in Rust, type judgment delegated:

[1] scan      oxc over each source file (reuse ec's frontend):                  ← Rust
  │           • #component/#tag pragmas → tag → class registry (project-wide)
  │           • tpl templates → per prop hole: { tag, prop, holeExpr, span }
  │             (the template lowering already surfaces attr name + expr + span)
  ▼
[2] codegen   emit synthetic assertion file(s):                                 ← Rust
  │           const _cN: ClassFor(tag)[prop] = (holeExpr);
  │           keyed by N → original span, plus the imports each assert needs
  ▼
[3] oracle    spawn `node` running the TS compiler API over                     ← node + project's tsc
  │           (project tsconfig + the virtual assert files) → JSON diagnostics
  │           → map each back to its template span → human report
  ▼
diagnostics (cli)
```

### The oracle abstraction

The type judgment is the only step `ec`'s native toolchain can't do (oxc has no checker). Hide it
behind one trait so the backend is swappable:

```rust
trait TypeOracle { fn check(&self, asserts: &AssertFile) -> Vec<Diagnostic>; }
```

- **`TscOracle` (ship this).** Rust spawns `node` running the TS compiler API. Authoritative,
  complete, available today.
- **`EznoOracle` (later).** Embed [ezno](https://github.com/kaleidawave/ezno) — a Rust TS checker —
  as a crate → `ea` becomes a single zero-dep native binary, no node. Blocked today: ezno's own
  README says it "does not currently support enough features to check existing projects," and it
  explicitly won't target `tsc` 1:1 parity. Flip the backend when that comes off. No rearchitecture.

### Two decisions that matter

1. **Resolve `typescript` from the project's `node_modules`, not a global.** Typecheck with the
   user's exact TS version, so `ea`'s verdicts always agree with what their editor already shows.
   This is what sidesteps the version-parity problem for free. Clear error if not found (note where
   we looked — monorepo hoisting, Bun/Deno-without-node_modules are the edge cases).
2. **Codegen, not a private assignability call** (see mechanism above).

### Error reporting — the part that makes it usable

The error shown to the user is NOT the raw `tsc` error. `tsc` reports against the synthetic file the
user never wrote (`_asserts.ts:1:31`) — useless on its own. `ea` translates it. Two halves:

**The "what" — donated by `tsc`, kept verbatim.** The diagnostic on
`const _c1: UserCard['name'] = (42)` is already great:

```
Type 'number' is not assignable to type 'string'.
```

Take `tsc`'s `messageText` as-is — it handles unions, excess properties, "did you mean", etc. for
free, and it's exactly what the user's IDE shows because it IS their `tsc`. Don't rewrite the
message; only reframe the subject (→ `prop 'name' of <user-card>`).

**The "where" — this is the work, all in the span map.** At codegen, key every synthetic line back
to the original site:

```
synthetic line N  ──▶  original { file, template span, prop, tag }
```

When `tsc` returns a diagnostic on line N, look up the span and re-render against the REAL source —
the template the user wrote:

```
error: type 'number' is not assignable to prop 'name' of <user-card> (expected 'string')
  ┌─ src/app.ts:42:24
  │
42│   tpl`<user-card name=${42}>`
  │                        ^^ number not assignable to string
```

oxc gives byte-accurate hole spans (the same ones `ec`'s lowering tracks), so the caret lands on
`${42}` — not the tag, not the synthetic file. Render with `oxc-miette`/`ariadne` (already in the
oxc stack).

**Caveats that decide whether it feels broken:**
- **Span fidelity is make-or-break.** Slightly-off map → caret on the wrong hole → tool feels
  broken. Round-trip test it: known-bad template → assert the caret byte-offset.
- **One assertion per hole.** Batch props into one blob and "line 5" becomes ambiguous. Strict
  one-assert-per-hole keying is what makes line-N → span exact.
- **Carry ABSOLUTE spans.** Hole spans must be absolute offsets into the original file, not relative
  to the template start, or carets drift inside nested `tpl` (lists, `when`). oxc spans are already
  absolute — just don't rebase them.

**Two output modes — same diagnostic data, different renderer:**
- `--pretty` (default) — human render: the reframed `tsc` message + the oxc caret frame into the
  real template source (the `^^ number not assignable to string` block above). For the terminal + CI.
- `--lsp` — structured JSON, LSP-shaped (`range`, `severity`, `message`, `code`). Machine-readable
  so an editor / LSP server is a thin transport on top later, NOT a new project. The analyzer stays
  the engine; this mode is the door left open with zero editor-junk commitment today.

Both fall out of the SAME span map: `--pretty` renders a caret from the span, `--lsp` emits a
`range`. Build the structured diagnostic first, render `--pretty` from it — don't bolt JSON on after.

### What's actually left (smaller than it looks)

Classification is NOT an open question — `grammar.rs` already maps `(Slot × sigil × value-shape) →
BindingKind`. The analyzer READS the kind, it doesn't redesign it: `:foo=${}` is a prop, `foo=${}`
an attr, `@click` an event, `ref`/class/style/list/child their own kinds. So "what is a prop" is
answered by the sigil grammar.

The remaining work is bounded — give each `BindingKind` its assertion **target type**:
- `Prop(name)` → `ClassFor(tag)[name]` (the real typed check, the whole point)
- `Attr(name)` → string-coercible (or skip — attrs stringify)
- `Event`/`Ref`/directives/spread → **skip** (not prop checks)

That's a per-kind lookup table, not a spec to invent. The only genuine judgement call is how strict
to be on plain attrs (coerce-anything vs require string-ish).

### Non-goals / tradeoffs

- **Not pure native.** This is the one elemix tool that needs `node` + the project's `typescript`
  present. The compiler stays pure native (parsing/lowering needs no type system); the analyzer
  fundamentally needs the type system, which only `tsc` fully implements.
- Not a language server. `--lsp` is an output FORMAT (LSP-shaped JSON diagnostics), not a running
  LSP server (no JSON-RPC lifecycle, no incremental sync). CLI one-shot first; a persistent `node`
  process for watch mode later, which is also where a real server would graft on if it ever happens.

### Where it lives — DECIDED: separate crate, library dep on the compiler

`ea` is its own crate (`packages/analyzer`, bin only) that depends on `elemix-compiler` as a
**library** — NOT a subcommand of `ec`, NOT a feature flag in the same crate.

```
packages/
  compiler/   elemix-compiler   lib + bin + wasm   ← stays pure
  analyzer/   elemix-analyzer    bin only           ← depends on elemix-compiler (lib)
```

Decisive reason — the **wasm purity invariant**: the compiler crate is `cdylib + rlib` so
`compile()` stays pure oxc, zero-IO, wasm-clean (the ~697kb playground module). `ea` is the
opposite — it spawns `node`, reads `tsconfig`, resolves `node_modules`, shells out to `tsc`; it can
NEVER be wasm. Same-crate would make a half-wasm-able crate and risk feature-unification dragging
subprocess/JSON deps into the pure build. Keep the target stories clean: compiler = native + wasm,
analyzer = native only.

Ranked rationale:
1. **Purity / wasm** (above).
2. **Dependency profile** — `ea` needs node-resolution + JSON + diagnostic-render deps the compiler
   must never carry.
3. **Packaging** — own npm package `@neuralfog/elemix-analyzer` (own per-arch binaries + the node
   driver script). Optional for users who only compile; keeps the compiler binary lean.
4. **Reuse stays clean** — `ea` depends on `elemix-compiler` with `default-features = false`: it
   pulls the oxc frontend + pragma scanner + template locate/spans (mostly already `pub`), but NOT
   `clap`/`glob` (behind the `cli` feature). Expose a few more fns `pub` deliberately if needed — a
   small intentional API surface beats polluting the pure crate.

Escalation path (YAGNI now): if `ea` later wants the frontend WITHOUT the compiler's codegen/emit
weight, extract a tiny `elemix-frontend` crate both depend on. Don't pre-split — the compiler lib
already IS the shared frontend today.