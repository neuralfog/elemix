# Changelog

All notable changes to elemix and its companion packages are documented here. They
share one version and release together, so they share one changelog. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/) when it suits me 😂😂😂.

> The [Roadmap](https://github.com/neuralfog/elemix/blob/main/ROADMAP.md) is the full
> log of development.

## [0.9.0-dev.17] - 2026-07-10

### Added

- Formatter: new `@neuralfog/elemix-template-formatter` (`etf`) - a native formatter for the HTML inside `tpl`` templates

### Changed

- Compiler: the emitted registration call is now `$__defineComponent`, completing the `$__` prefixing of runtime imports

## [0.9.0-dev.16] - 2026-07-09

### Fixed

- Analyzer: `#`/aliased imports from tsconfig `paths` now resolve, so an aliased component import no longer reads as a missing module

## [0.9.0-dev.15] - 2026-07-09

### Changed

- Compiler/Runtime: every runtime function the compiled output imports is now `$__` prefixed (`$__template`, `$__setText`, `$__state` etc) so it can't clash with a user's own module-scope names

## [0.9.0-dev.14] - 2026-07-08

### Added

- Runtime: new `match` directive - exhaustive pattern matching for templates. Works on string unions, enums, and tagged object unions (each branch gets the narrowed value)
- Analyzer: flags a missing case, a wrong case, or a non-finite value (like a plain `string`). Use `choose` for open conditions

### Changed

- Compiler: primitive `#state` backing fields are now prefixed (`#__count`) so they can't clash with your own private properties

## [0.9.0-dev.13] - 2026-07-07

### Added

- Runtime: `createApp(root?)` bootstrap with chainable `.config({ … })` / `.mount(target?)`; app-wide config lives on `window.__elemix__` (the root and both calls are optional, so `createApp().config({ … })` is valid)
- Runtime: automatic cloaking - elemix adopts a `[data-cloak], :not(:defined) { visibility: hidden }` stylesheet so elements don't flash before they upgrade and mount, with no per-app CSS; `config({ cloak: '…' })` replaces the rule with a custom CSS string
- Runtime: `config({ shadow: false })` makes components render to light DOM by default (shadow DOM stays the default otherwise)
- Compiler: new `#shadow` hint forces a shadow root even under a light-DOM default; it is mutually exclusive with `#no-shadow`, and using both on one component is a compile error
- Analyzer: reports `#shadow` and `#no-shadow` on the same component as an error

### Changed

- Storybook: ditched lit - `@neuralfog/elemix-storybook` and the storybook config now run on `@storybook/html-vite` instead of `@storybook/web-components-vite`, dropping lit-html from the dependency tree entirely (elemix always rendered plain string/Node, so lit was never used)

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

- `@neuralfog/elemix-analyzer` - static analysis tool for elemix

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
- Component inheritance - hooks/effects chain through `super`, stylesheets merge
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
