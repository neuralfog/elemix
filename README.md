# Elemix Monorepo

pnpm workspace housing the Elemix framework and its tooling.

Live playground: **[playground.elemix.dev](https://playground.elemix.dev/)**

The **[Roadmap](ROADMAP.md)** is the full log of development.

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
pushes a single `v<version>` tag, and CI publishes the whole toolchain — the library,
its Storybook integration, the compiler binaries, the wasm build, and the Vite plugin
— to npm.

```bash
# add a `## [<version>] - <date>` section to each packages/*/CHANGELOG.md first
pnpm bump <version | major | minor | patch>   # sync the version everywhere
git commit -am "release: v<version>"
pnpm tag                                       # push v<version> → CI publishes everything
```

Each package keeps its own `CHANGELOG.md` (shipped on npm). The same tag builds a
GitHub Release from those entries, linking each published package — `pnpm changelog:lint`
checks the format, and the release gates on every top entry matching the version.

### Dev releases

Prereleases publish under the `dev` dist-tag, so they never touch `latest`. The
trigger is a **hyphen** in the version — every publish step picks the tag with
`[[ "$VERSION" == *-* ]] && TAG=dev`. Spell it `0.9.0-dev.0`, never `0.9.0dev`
(no hyphen → it ships to `latest` and clobbers your stable pointer):

```bash
pnpm bump 0.9.0-dev.0                          # hyphen → stamps every manifest as a prerelease
git commit -am "release: v0.9.0-dev.0"
pnpm tag                                        # push v0.9.0-dev.0 → everything ships under @dev
```

Verify `@dev` moved and `@latest` stayed put:

```bash
npm view @neuralfog/elemix dist-tags           # latest: <unchanged>, dev: 0.9.0-dev.0
npm view @neuralfog/elemix-vite dist-tags
```

Install a dev build with `pnpm add @neuralfog/elemix@dev`. To re-trigger a botched
run, `pnpm tag-remove` then `pnpm tag` again.

See **[RELEASE-PIPELINE.md](RELEASE-PIPELINE.md)** for the full picture — the bump
fan-out, the CI workflows, changelogs, ordering, dist-tags, and provenance.
