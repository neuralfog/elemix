# Changelog

All notable changes to elemix and its companion packages are documented here. They
share one version and release together, so they share one changelog. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

> The [Roadmap](https://github.com/neuralfog/elemix/blob/main/ROADMAP.md) is the full
> log of development.

## [0.9.0-dev.12] - 2026-06-30

### Fixed

- Runtime: custom events (`@my-event`) now work; `_event` falls back to `addEventListener` when there is no `on*` property

## [0.9.0-dev.11] - 2026-06-30

### Fixed

- Compiler: multi-root conditional branches now render every root (only the first was kept before)

## [0.9.0-dev.10] - 2026-06-30

### Fixed

- Compiler: helper templates are now inlined inside a method-form `template()` (the splice pre-pass previously only saw the `template = () =>` arrow field, so helpers in a method template were left as runtime calls returning uncompiled `tpl` and threw)
- Compiler: a helper call nested inside another template (e.g. a `${cond ? tpl\`…${this.row(x)}…\` : tpl\`\`}` branch) is now inlined; the splice recurses into nested template holes instead of copying them verbatim

## [0.9.0-dev.9] - 2026-06-30

### Fixed

- Compiler: a `template()` method now lowers to `view()` like the `template = () =>` arrow field; previously only the arrow field was compiled, so the method form was left uncompiled and threw at runtime

## [0.9.0-dev.8] - 2026-06-24

### Added

- `@neuralfog/elemix-analyzer` — static analysis tool for elemix

## [0.9.0-dev.7] - 2026-06-22

### Changed

- WASM package ships its own README

## [0.9.0-dev.6] - 2026-06-22

### Added

- Prebuilt binaries attached to every GitHub release

## [0.9.0-dev.5] - 2026-06-22

### Fixed

- Compiler hint detection in the Vite plugin

## [0.9.0-dev.4] - 2026-06-22

### Added

- Compiler hints: `#component`/`#tag`/`#form`/`#no-shadow`/`#styles`/`#state`/`#effect` + lifecycle `#before-mount`/`#mount`/`#dispose`
- Reactive primitives in component `#state` (`count = 0` stays reactive)
- Component inheritance — hooks/effects chain through `super`, stylesheets merge
- Collections in reactive state (`Set`/`Map`/`WeakSet`/`WeakMap`), classes in state, `raw()` helper
- Source maps back to the original source
- Inlined compiler diagnostics with `--strict`; CLI version banner

### Changed

- Performance optimisations

### Fixed

- Nested arrays in deep state, template-less pragma components, statements before `return`, dangling `Cargo.lock`

## [0.9.0-dev.3] - 2026-06-16

### Added

- Comment pragmas, effects, source maps

## [0.9.0-dev.2] - 2026-06-15

### Added

- Compiler hints

## [0.9.0-dev.1] - 2026-06-14

### Added

- Optimisations

## [0.9.0-dev.0] - 2026-06-14

### Added

- Initial release: compiled renderer
