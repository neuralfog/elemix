# Changelog

All notable changes to elemix and its companion packages are documented here. They
share one version and release together, so they share one changelog. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/) when it suits me 😂😂😂.

> The [Roadmap](https://github.com/neuralfog/elemix/blob/main/ROADMAP.md) is the full
> log of development.

## [0.9.9] - 2026-11-19

### Removed

- The `@neuralfog/elemix-ssr` package is gone. Its SSR runtime and build live in
  elemix now, so it is one package to install, not two.

### Changed

- Inlined component SCSS is compiled by the elemix compiler itself, and minified
  in production builds.
- The compiler elides the reactive effect for template expressions it can prove
  static. A constant bound once becomes a plain write instead of a tracked
  effect that could never fire again.
- Reactive dependency records live on the reactive object behind a
  non-enumerable symbol instead of a side `WeakMap`. Every tracked read is a
  property load rather than a hash lookup, and the record is collected with the
  object.
- The runtime writes class bindings as-is and no longer de-duplicates repeated
  tokens on every update. The browser never minded the duplicates, and the work
  was not free.

### Fixed

- `render()` repaints nested content. A manual repaint updated only top-level
  holes, leaving keyed-list rows and `when`/`choose` branches stale. It now
  reaches inside matched rows and conditional branches. `#effect` stays
  reactive-only, so a manual repaint never fires it.

## [0.9.8] - 2026-11-16

### Changed

- elemix compiles events bound inside a `repeat` row to event delegation: one
  listener per event type dispatches the whole list instead of a handler on
  every row. Top-level and non-bubbling events keep their direct binding.
- hydris production builds now minify their output: component CSS and SSR inline
  styles through the compiler, the client hydration bundles through the bundler.

### Fixed

- hydris soft navigation resets the scroll position to the top after every
  navigation.

## [0.9.7] - 2026-11-15

### Added

- `html()` content directive: drop a trusted HTML string into a template hole
  (`${html(markup)}`) and it renders as live DOM, compiled for both SSR and the
  client. Vue's `v-html`, resolved at compile time rather than at runtime.

### Changed

- hydris `Serve(ServerConfig)` is now typed, and the CLI auto-loads `.env`.

### Fixed

- elemix-ssr now compiles `node_modules` `.ts` files that carry elemix markers.
  Components shipped as source (such as `NavLink`) register correctly instead of
  rendering empty inside nested shadow roots.
- Raw-element content stays verbatim: the compiler no longer collapses whitespace
  inside `<pre>`, `<textarea>`, `<script>` and `<style>`, and the formatter no
  longer dedents `<pre>` content rendered through a hole.
- hydris sends no response body on `304` and `204` responses.

## [0.9.6] - 2026-11-14

### Added

- hydris is now a Native-AOT C# framework published to NuGet, as four packages:
  `Hydris`, `Hydris.QuickJs`, `Hydris.Generators` and `Hydris.Cli`. The renderer
  ships prebuilt native binaries for Linux, macOS and Windows on x64 and arm64,
  published through trusted publishing (OIDC).
- Server-side rendering of elemix components through an embedded QuickJS engine.
- Server actions in the style of tRPC: `[Action]` and `[Contract]` source
  generators bind and validate request DTOs, write response DTOs, and generate a
  typed TypeScript client plus a reactive action function on the elemix side.
  End-to-end type safety bridges the C# backend and TypeScript frontend through a
  generated client, rather than the shared-TypeScript inference tRPC relies on.
- A validation rule engine wired into contract DTOs through typed rule attributes.
- Contract support for complex types (enums, dates, nested objects, arrays) on both
  request parse and response write.
- Ambient request context: route params, query and CSRF are passed to every
  template and readable in TypeScript via `param()`, `query()` and `csrf()`.
- Action request binding from route and query params, request cancellation, and
  custom response status and headers.
- CSRF protection with configurable cookie and header names.
- Security response headers (HSTS, nosniff, referrer policy).
- A `[Config]` attribute for DI config services and CSP.
- `Hydris.Env` for `.env` loading and typed validation.
- A swappable logger with a driver/adapter pattern.
- Opt-in compression, content-hashed assets, and per-request module store reset.
- Cookie-backed stores.
- Client-side soft navigation with hydration.
- `Hydris.Cli` task runner, including a `routes` command that lists built-in routes.
- A public `reactive()` primitive in elemix; server actions return a reactive handle.

### Changed

- hydris was rewritten from the JavaScript proof of concept to C# with Native-AOT.
  The renderer is QuickJS embedded through a native shim with an engine-owned
  render buffer.
- CSR, SSR and compiler-output performance passes.
- The optimise pass moved into the compiler.

### Fixed

- Reactivity audit pass across the runtime and compiler: text-hole hydration,
  `deleteProperty` and root reactive array tracking, fragment row and fragment
  hole moves, class de-duplication, and cross-run split-text holes. Each fix is
  pinned by a fixture run in both the CSR and SSR harnesses.
- Template and markup-returning holes survive SSR render and hydration, mounted
  as children with the server DOM normalised before fixed-path navigation.
- Conditional holes survive data flipping to null; torn-down effects are disposed
  so a stale subscriber copy cannot re-run them.
- The QuickJS window mock no longer stands in for a client check during SSR.
- Navigation, store and `activeScopes` exports corrected.

### Removed

- `@neuralfog/elemix-storybook`.
- The JavaScript hydris proof of concept.

### Security

- hydris security audit and resolution of its findings (header/CRLF injection,
  nosniff, routing denial of service, type confusion, and others).

## [0.9.5] - 2026-08-22

### Fixed

- elemix/hydris bugfixing spree.

## [0.9.4] - 2026-08-17

### Added

- Initial release of `@neuralfog/hydris`.

## [0.9.3] - 2026-08-04

### Added

- SSR mode to the compiler.

### Fixed

- Deep reactivity bug in props.

## [0.9.2] - 2026-07-29

### Fixed

- READMEs in npm packages.

## [0.9.1] - 2026-07-28

### Fixed

- VS Code extension is back on the Marketplace under `0.9.1`. The `0.9.0` listing was
  pulled, and the Marketplace permanently retires a removed extension's ID and burns every
  version number it ever published (the pre-release `0.9.0` builds included), so `0.9.0`
  can never be republished. `0.9.1` is the first clean version it will accept.

### Changed

- Whole toolchain bumped to `0.9.1` in lockstep, so the editor extensions never drift from
  the runtime version even when only the VS Code extension needed the re-release.

## [0.9.0] - 2026-07-27

### Changed

- Official release of v0.9.0

## [0.9.0-dev.23] - 2026-07-15

### Added

- `create-elemix-app` - scaffold a new app from the official template (`npm create elemix-app`)
- VS Code `.vsix` attached to GitHub Releases, plus a Marketplace link in the release notes

### Changed

- Marketplace publish is skipped when the version is already published

## [0.9.0-dev.22] - 2026-07-14

### Added

- VS Code extension on the Marketplace

### Changed

- Format on save is now an editor toggle, not `elemix.toml`

## [0.9.0-dev.21] - 2026-07-14

### Added

- Neovim editor extension
- Vscode editor extension

### Changed

- Formatter is configured from `elemix.toml` (`[formatter]`) this includes editor extensions

### Fixed

- Vite plugin now compiles a file whose only hint is `// #shadow`

## [0.9.0-dev.20] - 2026-07-11

### Fixed

- Storybook: `elemixDecorator` no longer pre-mounts the story into `#storybook-root`; it renders into a detached host that Storybook mounts itself. Under the Vitest runner the canvas is a per-test element, so the old pre-mount left the component connected to the wrong tree and a subsequent move disconnected it - tearing down its reactive scopes, so interactions stopped updating the DOM

## [0.9.0-dev.19] - 2026-07-11

### Added

- New `@neuralfog/elemix-testing-library`: shadow-piercing queries (`/query`), real DOM events (`/events`), and `expect`/`waitFor` assertions

### Changed

- Compiler conformance stories now assert with `@neuralfog/elemix-testing-library` instead of `storybook/test`
- Compiler conformance stories now run headless across Chromium, Firefox, and WebKit (Safari's engine)
- Isolated `Component` internals behind a `$$__` prefix so user code can no longer shadow them

## [0.9.0-dev.18] - 2026-07-10

### Added

- Free-standing templates: a `tpl` outside a component now compiles to an inline builder

### Changed

- Updated dependencies to their latest versions and TypeScript 7
- Updated the Rust toolchain and crate dependencies

### Fixed

- Storybook: `ElemixStory` now exposes every property of the underlying story type (`play`, `beforeEach`, `tags`, ...) instead of a hand-picked subset; removed the dead `setup` hook (`beforeRender`/`afterRender` remain)

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
