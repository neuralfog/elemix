# COMPILER TESTING PIPELINE

One `pnpm test`, four gates, run in sequence and joined with `&&` — the first
failure stops the rest. Each gate catches a different class of bug, so a green
run means the compiler is correct, its output runs, and the fixtures are valid.

```
                              pnpm test
        (compiler pkg; also runs from root `pnpm -r test` and in CI)
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ① test:rust                                            cargo test      │
   │ ---------------------------------------------------------------------- │
   │   94 tests / 11 binaries                                               │
   │   parse · grammar · lower · codegen · splice · rewrite · cli           │
   │   + snapshots (insta) — locks the emitted output of all 37 fixtures    │
   │   CATCHES → codegen drift, stage-level correctness                     │
   └──────────────────────────────────────────────────────────────────────┘
                                  │ &&
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ② test:wasm                          build:wasm + node harnesses       │
   │ ---------------------------------------------------------------------- │
   │   build:wasm   wasm-pack --target web → pkg (~697kb, wasm-opt)         │
   │   conformance  wasm compile() == native, 37/37 byte-match (vs snaps)   │
   │   robustness   10 malformed inputs → graceful passthrough, 0 crashes   │
   │   CATCHES → wasm diverging from native, panics on half-typed input     │
   └──────────────────────────────────────────────────────────────────────┘
                                  │ &&
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ③ test:types               tsc --noEmit -p tsconfig.fixtures.json      │
   │ ---------------------------------------------------------------------- │
   │   typecheck all 37 fixtures (real user-facing component source)        │
   │   CATCHES → invalid TypeScript in a fixture BEFORE it is ever compiled │
   └──────────────────────────────────────────────────────────────────────┘
                                  │ &&
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ④ test:storybook          compile:stories + vitest (real chromium)     │
   │ ---------------------------------------------------------------------- │
   │   compile:stories  native binary compiles 37 fixtures → .emited        │
   │   25 component plays  mount compiled custom elements, drive every      │
   │                       button/model/state, assert across shadow roots   │
   │   wasm story          compiles a component INSIDE the browser          │
   │   CATCHES → compiled output that emits fine but doesn't RUN / react    │
   └──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                                PASS ✅
```

## One source of truth: `tests/fixtures/*.ts` (37 components)

The same 37 fixtures feed every gate — they are the spec. Nothing is mocked.

```
                 tests/fixtures/*.ts  (37 components)
                          │
      ┌───────────────────┼───────────────────┬───────────────────┐
      ▼                   ▼                   ▼                   ▼
  cargo test          wasm compile()       tsc typecheck      native binary
  → insta .snap       → byte-match .snap   → must be valid    → .emited → browser
   (the baseline)        (wasm == native)        TS                 (it runs)
```

## The conformance triangle

Three independent angles prove the compiled output is correct:

```
                 native compile()  ──(insta)──►  .snap baseline
                        ▲                              ▲
                        │ same compiler logic          │ wasm must match it
                        │                              │
                  browser: it RUNS  ◄──────────  wasm compile()
                (chromium, plays)            (node, 37/37 byte-match)
```

- **native == snapshot** — `cargo test` (insta) locks the emitted code.
- **wasm == snapshot** — `test:wasm` proves the wasm build is byte-identical to native.
- **it runs** — `test:storybook` mounts the compiled output in a real browser, and
  the wasm story compiles in-browser too.

## Gate summary

| # | gate | command | proves | catches |
|---|------|---------|--------|---------|
| ① | `test:rust` | `cargo test` | stages + locked output | codegen drift, logic bugs |
| ② | `test:wasm` | `build:wasm` + harnesses | wasm == native, no panics | wasm divergence, bad-input crash |
| ③ | `test:types` | `tsc` on fixtures | fixtures are valid TS | invalid user source |
| ④ | `test:storybook` | `compile:stories` + vitest | compiled output runs | non-running / non-reactive output |

## Running it

```bash
pnpm test            # all four gates, in order

pnpm test:rust       # cargo test (parse/grammar/lower/codegen/splice/rewrite/cli + snapshots)
pnpm test:wasm       # build wasm + conformance + robustness
pnpm test:types      # typecheck the fixtures
pnpm test:storybook  # compile fixtures + run the browser plays
```

Re-bless intentional codegen changes:

```bash
INSTA_UPDATE=always cargo test --test snapshots   # or: cargo insta review
```

## CI

`.github/workflows/test.yml` runs `pnpm test` on every push/PR. It provisions the
Rust toolchain + `wasm32-unknown-unknown` target + `wasm-pack`, and installs the
chromium browser for the Storybook gate — so all four gates fire in CI exactly as
they do locally.
