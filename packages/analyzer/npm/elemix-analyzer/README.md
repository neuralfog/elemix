# 🚦 Elemix Analyzer ⚠️ **Experimental**

The template **prop typechecker** for [Elemix](https://www.npmjs.com/package/@neuralfog/elemix). It resolves each `<tag>` in your `tpl` templates back to its `#component` class and type-checks every `:prop=${expr}` against that prop's type — the cross-component check `tsc` can't do on its own (a template hole is an opaque string to it).

This package ships a **prebuilt static binary** — no Rust toolchain required. It does need **node** + the project's **typescript**: type judgment is delegated to your own `tsc`, so verdicts match what your editor shows.

Installing pulls in exactly one platform binary via `optionalDependencies`:

| Platform | Package |
| --- | --- |
| linux x64 | `@neuralfog/elemix-analyzer-linux-x64` |
| linux arm64 | `@neuralfog/elemix-analyzer-linux-arm64` |
| macOS x64 | `@neuralfog/elemix-analyzer-darwin-x64` |
| macOS arm64 | `@neuralfog/elemix-analyzer-darwin-arm64` |
| Windows x64 | `@neuralfog/elemix-analyzer-win32-x64` |
| Windows arm64 | `@neuralfog/elemix-analyzer-win32-arm64` |

## Usage

Installs two equivalent commands — `ea` (short) and `elemix-analyzer`:

```sh
ea --dirs <dir|glob>... --root <project>
ea --dirs src --lsp          # LSP-shaped JSON diagnostics
```

Exits non-zero when a prop type error is found, so it drops straight into CI.
