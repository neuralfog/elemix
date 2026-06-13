# RELEASE PIPELINE

One version, one tag, everything ships. `pnpm bump` locksteps every version in the
repo, `pnpm tag` pushes a single `v<version>` tag, and two CI workflows publish the
whole toolchain to npm — in the right order.

```
   pnpm bump <ver>          git commit          pnpm tag            push v<ver>
   ───────────────►         ─────────►          ────────►           ──────────►
   sync every version       commit the          create + push       CI fires
   across the repo          bump                 ONE tag v<ver>      two workflows
                                                      │
                                ┌─────────────────────┴─────────────────────┐
                                ▼                                           ▼
                        release-compiler.yml                          release-vite.yml
                        native binaries + wasm                        the Vite plugin
                                │                                           │
                                ▼                                           ▼
                               npm  ◄──── (vite waits for the compiler) ────┘
```

## ① Version — `pnpm bump <version | major | minor | patch>`

Locksteps the version **everywhere** from one source of truth (the root manifest):

```
package.json                                          (root)
packages/{elemix,storybook,vite,compiler}/package.json    every workspace package
packages/compiler/npm/*  (launcher + 6 platform pkgs)     via version.mjs, optionalDeps pinned
packages/compiler/Cargo.toml  →  [package] version
packages/vite  →  the @neuralfog/elemix-compiler dependency pin   (cross-dep lockstep)
```

## ② Tag — `pnpm tag` / `pnpm tag-remove`

```
pnpm tag         create + push annotated  v<version>   (skips an existing tag)
pnpm tag-remove  delete  v<version>  local + remote    (re-trigger / cleanup)
```

A single `v<version>` tag fires **both** release workflows. The version is read
from the tag (`v0.9.0` → `0.9.0`) — the tag is the source of truth, not the
committed manifests.

## ③ CI — one `v*` tag, two workflows

### release-compiler.yml → native binaries + launcher + wasm

```
build (matrix · 6 targets)
   linux-x64 · linux-arm64     static musl, zig-cross on ubuntu
   darwin-x64 · darwin-arm64   native on macos (universal SDK)
   win32-x64 · win32-arm64     native / cross on windows
        │  each drops its binary into npm/<platform>/ → uploads artifact
        ▼
 publish (needs: build)                 publish-wasm (independent)
   download binaries, chmod +x            wasm-pack build --target web
   stamp version (from tag)               stamp name + version (from tag)
   npm publish 6 platform pkgs            npm publish @…-compiler-wasm
   npm publish launcher
```

Publishes: `@neuralfog/elemix-compiler` (launcher) · 6× `@neuralfog/elemix-compiler-<platform>` · `@neuralfog/elemix-compiler-wasm`.

### release-vite.yml → the Vite plugin

```
install · build (tsc)
   → resolve <version> from the tag
   → stamp package.json:  version = <version>,  @neuralfog/elemix-compiler = <version>
   → ⏳ WAIT for @neuralfog/elemix-compiler@<version> on npm
   → npm publish @neuralfog/elemix-vite
```

The wait makes vite publish **after** the compiler it depends on — an installer
never sees a missing dependency. The compiler pin is stamped to the version being
released, so the plugin always depends on the exact build it ships with.

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
pnpm bump 0.9.0
git commit -am "release: v0.9.0"
pnpm tag                                  # push v0.9.0 → CI publishes everything @0.9.0

# prerelease (manual tag — pnpm tag derives the stable version from the root)
git tag v0.0.0-dev.4 && git push origin v0.0.0-dev.4
```

Verify:

```bash
npm view @neuralfog/elemix-compiler@dev version
npm view @neuralfog/elemix-compiler-wasm@dev version
npm view @neuralfog/elemix-vite@dev version
```

## Still manual (being sunset)

`@neuralfog/elemix` and `@neuralfog/elemix-storybook` publish via `pnpm release`
(`pnpm build && pnpm -r publish`). Moving to the same `v*` tag-driven flow so the
whole repo releases from one tag.
