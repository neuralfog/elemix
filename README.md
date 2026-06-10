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

Every package shares a single version, bumped in lockstep by `scripts/bump.mjs`.

One-time setup:

```bash
npm login           # must have publish rights to the @neuralfog org
```

Normal flow:

```bash
pnpm bump <version | major | minor | patch>   # rewrite the version line in every package.json + root
git add -A && git commit -m "version packages"
pnpm release                                   # = pnpm build && pnpm -r publish
```

`pnpm -r publish` publishes each public package in dependency order and rewrites `workspace:*` to the concrete version in the published manifest. It is idempotent — only versions not already on the registry are pushed.

Notes:

- Always release from the **root** (`pnpm release`); don't run per-package publish scripts directly.
- Commit before publishing.
