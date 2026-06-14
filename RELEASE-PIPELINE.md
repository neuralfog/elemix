# RELEASE PIPELINE

One version, one tag, everything ships. `pnpm bump` locksteps every version in the
repo, `pnpm tag` pushes a single `v<version>` tag, and three CI workflows publish the
whole toolchain to npm — in the right order.

```
   pnpm bump <ver>          git commit          pnpm tag            push v<ver>
   ───────────────►         ─────────►          ────────►           ──────────►
   sync every version       commit the          create + push       CI fires
   across the repo          bump                 ONE tag v<ver>      three workflows
                                                      │
                ┌───────────────────────────────────────┼───────────────────────────────────────┐
                ▼                                       ▼                                       ▼
        release-compiler.yml                    release-vite.yml                       release-elemix.yml
        native binaries + wasm                  the Vite plugin                        library + storybook
                │                                       │                                       │
                │                          (vite waits for compiler)                  elemix ──► storybook
                ▼                                       ▼                                       ▼
               npm                                     npm                                     npm
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

A single `v<version>` tag fires **all three** release workflows. The version is read
from the tag (`v0.9.0` → `0.9.0`) — the tag is the source of truth, not the
committed manifests.

## ③ CI — one `v*` tag, three workflows

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

### release-elemix.yml → the library + its Storybook integration

```
publish-elemix                          publish-storybook (needs: publish-elemix)
   stamp version (from tag)               stamp version + elemix peer-dep (from tag)
   build the library                      build elemix (types), then storybook
   npm publish @neuralfog/elemix          ⏳ WAIT for @neuralfog/elemix@<version> on npm
                                          npm publish @neuralfog/elemix-storybook
```

Storybook peer-depends on `@neuralfog/elemix`, so it publishes second. pnpm rewrites
its `workspace:*` peer-dep to elemix's version field at publish time — both manifests
are stamped to the tag, so the peer resolves to the version being released. The wait
guards against npm's CDN propagation lag.

Publishes: `@neuralfog/elemix` · `@neuralfog/elemix-storybook`.

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

## ④ Changelogs + release notes — `release-notes.yml`

Every package keeps its own `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com)
format) and ships it inside its npm tarball (it's in each package's `files`). On the
same `v*` tag, `release-notes.yml` turns those into one GitHub Release — **no artifacts
attached**, since the packages already live on npm:

```
node scripts/changelog.mjs check <version>      gate: every package's top entry == <version>,
                                                and the changelogs are well-formed
node scripts/release-notes.mjs <version>        assemble per-package sections + npm links
gh release create v<version> --notes-file …     (--prerelease when the version has a hyphen)
```

Each block in the release body links the package on npm at that exact version
(`npmjs.com/package/<pkg>/v/<version>`). The format check also runs on every PR
(`pnpm changelog:lint` in `test.yml`), so a malformed or out-of-date changelog is
caught before release.

```
              v<version>
       ┌──────────┬──────────┬──────────────┐
       ▼          ▼          ▼              ▼
   compiler     vite      elemix      release-notes.yml
     npm         npm        npm        GitHub Release
                                       (changelogs + npm links, no artifacts)
```

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
