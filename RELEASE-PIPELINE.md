# RELEASE PIPELINE

One version, one tag, everything ships — **gated**. `pnpm bump` locksteps every version
in the repo, `pnpm tag` pushes a single `v<version>` tag, and **one** CI workflow
(`release.yml`) runs the whole toolchain through a fail-fast pipeline: nothing reaches
npm unless the tests pass, the changelogs are in order, and every binary built.

```
   pnpm bump <ver>      git commit      pnpm tag         push v<ver>      release.yml (one gated DAG)
   ───────────────►     ─────────►      ────────►        ──────────►
   sync every version   commit the      create + push    CI fires
   across the repo      bump            ONE tag v<ver>

        test  ─►  changelog  ─►  build-compiler (6 binaries)  ─►  publish-*  ─►  release-notes
        (full     (top entry      (the one build the test         (compiler · wasm ·    (GitHub
         suite)    == <ver>)       gate can't cover; ANY           elemix · storybook ·  Release)
                                   target fails ⇒ no publish)      vite)
                                                                     │
                                            nothing publishes unless every step left is green;
                                            cross-package order (storybook→elemix, vite→compiler)
                                            comes from `needs:`, not npm polling.
```

## ① Version — `pnpm bump <version | major | minor | patch>`

Locksteps the version **everywhere** from one source of truth (the root manifest):

```
package.json                                          (root)
packages/{elemix,storybook,vite,compiler}/package.json    every workspace package
packages/compiler/npm/*  (launcher + 6 platform pkgs)     via version.mjs, optionalDeps pinned
packages/compiler/Cargo.toml  →  [package] version
```

The vite plugin's `@neuralfog/elemix-compiler` pin is **not** bumped here — it stays at
a published, lockfile-resolvable version so installs work, and the `publish-vite` job
stamps it to the release version at publish time.

## ② Tag — `pnpm tag` / `pnpm tag-remove`

```
pnpm tag         create + push annotated  v<version>   (skips an existing tag)
pnpm tag-remove  delete  v<version>  local + remote    (re-trigger / cleanup)
```

A single `v<version>` tag fires **all three** release workflows. The version is read
from the tag (`v0.9.0` → `0.9.0`) — the tag is the source of truth, not the
committed manifests.

## ③ CI — one `v*` tag, one gated workflow (`release.yml`)

A single workflow runs the whole release as a `needs:`-wired DAG. Every job is a gate
for the next; a failure anywhere upstream means **nothing publishes**.

```
version ──┐  (resolve <version> from the tag, or the manual workflow_dispatch input)
          │
test  ────┤  GATE 1 — reuses test.yml (workflow_call): pnpm install · build (compiler +
          │           every lib + wasm conformance) · lint · full test suite.
          ▼
changelog ─  GATE 2 — node scripts/changelog.mjs check <version>
          ▼           (every package's top entry == <version>, well-formed)
build-compiler (matrix · 6 targets)   ← the ONE build the test gate can't cover
   linux-x64 · linux-arm64   musl, zig-cross on ubuntu
   darwin-x64 · darwin-arm64 cross on Apple Silicon (universal SDK)
   win32-x64 · win32-arm64   on windows
        │  each drops its binary into npm/<platform>/ → uploads artifact.
        │  fail-fast:false, but ANY target failing fails the job ⇒ no publish.
        ▼
   ── every publish needs build-compiler (⇒ changelog ⇒ test): the "publish
      only if EVERYTHING built" guarantee. Cross-deps ordered by `needs:` ──
        │
  ┌─────┼───────────────┬────────────────┬─────────────────────┐
  ▼     ▼               ▼                ▼                     ▼
publish-compiler   publish-wasm   publish-elemix        (rebuild-in-publish, opt-b)
  download arts      wasm-pack       stamp + build            │
  stamp version      build+stamp     npm publish              ├─► publish-storybook
  publish 6+launcher npm publish                              │     needs publish-elemix
                                                              │     (short CDN wait)
                                                              └─► publish-vite
                                                                    needs publish-compiler
                                                                    (pin compiler = <ver>,
                                                                     short CDN wait)
        ▼
release-notes  needs: ALL publishes — assemble per-package changelog sections +
               npm links → one GitHub Release (--prerelease when <ver> has a hyphen).
               No artifacts attached; the packages already live on npm.
```

Publishes (under `latest`, or `dev` when the version has a hyphen):
`@neuralfog/elemix-compiler` (launcher) · 6× `…-compiler-<platform>` · `…-compiler-wasm` ·
`@neuralfog/elemix` · `@neuralfog/elemix-storybook` · `@neuralfog/elemix-vite`.

**Ordering without polling.** Storybook peer-depends on elemix and vite pins the native
compiler, so they publish *after* their dep — but that's now a `needs:` edge inside one
DAG, not a cross-workflow guess. The remaining `npm view` wait is a short ride-out of
CDN propagation lag (the publish already ran), not a blind poll. pnpm rewrites
storybook's `workspace:*` peer to elemix's stamped version at publish time; vite's
compiler pin is stamped to `<version>` so the plugin always depends on the build it ships with.

The changelog format check also runs on every PR (`node scripts/changelog.mjs lint` in
`test.yml`), so a malformed changelog is caught long before release.

## dist-tags

```
0.9.0        →  latest     (stable)
0.0.0-dev.4  →  dev        (prerelease — any version containing a hyphen)
```

## Provenance

Every CI publish uses `npm publish --provenance` (GitHub OIDC). Each manifest
carries a `repository` field so the provenance attestation verifies.

## Runbook

```bash
# stable release
# 1. add a `## [0.9.0] - <date>` section to each packages/*/CHANGELOG.md
pnpm changelog:check 0.9.0                # verify every top entry == 0.9.0 (run before tagging)
pnpm bump 0.9.0
git commit -am "release: v0.9.0"
pnpm tag                                  # push v0.9.0 → CI publishes everything @0.9.0

# prerelease (manual tag — pnpm tag derives the stable version from the root)
git tag v0.0.0-dev.4 && git push origin v0.0.0-dev.4
```

Verify:

```bash
npm view @neuralfog/elemix@dev version
npm view @neuralfog/elemix-storybook@dev version
npm view @neuralfog/elemix-compiler@dev version
npm view @neuralfog/elemix-compiler-wasm@dev version
npm view @neuralfog/elemix-vite@dev version
```
