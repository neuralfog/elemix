# Elemix Monorepo

pnpm workspace housing the Elemix framework and its tooling.

Live playground: **[playground.elemix.dev](https://playground.elemix.dev/)**

## Packages

| Package | Description | Docs |
| --- | --- | --- |
| `@neuralfog/elemix` | Reactive elements (CustomElements). | [README](packages/elemix/README.md) |
| `@neuralfog/elemix-compiler` | Rust Compiler. | [README](packages/compiler/README.md) |
| `@neuralfog/elemix-storybook` | Storybook integration for Elemix. | [README](packages/storybook/README.md) |

`@neuralfog/elemix-storybook` depends on `@neuralfog/elemix` via `workspace:*`, so the workspace always builds/tests against the local source.

## Releasing

Every package shares a single version, bumped in lockstep by `scripts/bump.mjs` —
`pnpm bump` syncs it across the whole repo: every `package.json`, the compiler's
published npm packages (launcher + per-platform binaries), and the Rust `Cargo.toml`.

Release cycle:

```bash
pnpm bump <version | major | minor | patch>   # sync the version everywhere
git commit -am "release: v<version>"
pnpm tag                                       # push v<version> + elemix-compiler-v<version>
```

The `elemix-compiler-v<version>` tag triggers the `release-compiler` workflow, which
cross-compiles the binary for every platform and publishes the compiler to npm — no
local toolchain or login needed. `pnpm tag-remove` deletes both tags (local + remote)
to re-trigger or clean up.

> **`pnpm release` is being sunset.** It still publishes `@neuralfog/elemix` and
> `@neuralfog/elemix-storybook` from your machine (`pnpm build && pnpm -r publish`,
> needs `npm login` with publish rights to the `@neuralfog` org). We're moving to a
> fully tag-driven cycle where every package publishes from CI on its tag — the way the
> compiler already does — so this manual step will go away.
