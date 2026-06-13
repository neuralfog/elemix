# Elemix Monorepo

pnpm workspace housing the Elemix framework and its tooling.

Live playground: **[playground.elemix.dev](https://playground.elemix.dev/)**

## Packages

| Package | Description | Docs |
| --- | --- | --- |
| `@neuralfog/elemix` | Reactive Elements (CustomElements). | [README](packages/elemix/README.md) |
| `@neuralfog/elemix-compiler` | Rust Compiler. | [README](packages/compiler/README.md) |
| `@neuralfog/elemix-vite` | Vite Compiler plugin. | [README](packages/vite/README.md) |
| `@neuralfog/elemix-storybook` | Storybook Integration For Elemix. | [README](packages/storybook/README.md) |

`@neuralfog/elemix-storybook` depends on `@neuralfog/elemix` via `workspace:*`, so the workspace always builds/tests against the local source.

## Releasing

One version, one tag. `pnpm bump` locksteps every version across the repo, `pnpm tag`
pushes a single `v<version>` tag, and CI publishes the whole toolchain — the compiler
binaries, the wasm build, and the Vite plugin — to npm.

```bash
pnpm bump <version | major | minor | patch>   # sync the version everywhere
git commit -am "release: v<version>"
pnpm tag                                       # push v<version> → CI publishes everything
```

See **[RELEASE-PIPELINE.md](RELEASE-PIPELINE.md)** for the full picture — the bump
fan-out, both CI workflows, ordering, dist-tags, and provenance.

> **`pnpm release` is being sunset** — it still publishes `@neuralfog/elemix` and
> `@neuralfog/elemix-storybook` from your machine; moving to the same `v*` tag flow.
