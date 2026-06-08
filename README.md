# Elemix Monorepo

pnpm workspace housing the Elemix framework and its tooling.

## Packages

| Package | Description | Docs |
| --- | --- | --- |
| `@neuralfog/elemix` | Reactive elements based on Custom Elements. | [README](packages/elemix/README.md) |
| `@neuralfog/elemix-storybook` | Storybook integration for Elemix. | [README](packages/storybook/README.md) |

`@neuralfog/elemix-storybook` depends on `@neuralfog/elemix` via `workspace:*`, so the workspace always builds/tests against the local source.

## Development

```bash
pnpm install        # install + link the workspace
pnpm build          # build every package (topological order)
pnpm test           # run every package's tests
pnpm lint           # tsc + Biome across the workspace
pnpm lint:fix       # apply Biome fixes across the workspace
pnpm storybook      # run the Storybook dev server
```

> `@neuralfog/elemix-storybook` imports `@neuralfog/elemix/render`, which resolves to the framework's `dist/`. Build elemix at least once (`pnpm build`) before linting/building storybook — `pnpm build` already does this in dependency order.

## Releasing

Both packages are a **fixed** [Changesets](https://github.com/changesets/changesets) group: they always version and publish together under the same number.

One-time setup:

```bash
npm login           # must have publish rights to the @neuralfog org
```

Normal flow:

```bash
pnpm changeset                      # describe the change + pick the bump
pnpm version                        # bump both packages + update CHANGELOGs
git add -A && git commit -m "version packages"
pnpm release                        # = pnpm build && changeset publish
```

`changeset publish` publishes each package in dependency order and rewrites `workspace:*` to the concrete version in the published manifest. It is idempotent — only versions not already on the registry are pushed.

Notes:

- Always release from the **root** (`pnpm release`) so both go together; don't run the per-package publish scripts directly.
- Commit before publishing — `changeset publish` tags the current commit.
