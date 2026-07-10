# 🎀 Elemix Template Formatter ⚠️ **Experimental**

A native formatter for the HTML inside ``tpl`...` `` tagged template literals in [Elemix](https://www.npmjs.com/package/@neuralfog/elemix) components. It reformats just the template markup and leaves every `${…}` hole and all surrounding TypeScript byte-for-byte untouched.

This package ships a **prebuilt static binary** — no Rust toolchain required. Installing pulls in exactly one platform binary via `optionalDependencies`:

| Platform | Package |
| --- | --- |
| linux x64 | `@neuralfog/elemix-template-formatter-linux-x64` |
| linux arm64 | `@neuralfog/elemix-template-formatter-linux-arm64` |
| macOS x64 | `@neuralfog/elemix-template-formatter-darwin-x64` |
| macOS arm64 | `@neuralfog/elemix-template-formatter-darwin-arm64` |
| Windows x64 | `@neuralfog/elemix-template-formatter-win32-x64` |
| Windows arm64 | `@neuralfog/elemix-template-formatter-win32-arm64` |

## Usage

Installs two equivalent commands — `etf` (short) and `elemix-template-formatter`:

```sh
etf --dirs src            # lint: print a diff, exit 1 if anything is unformatted
etf --dirs src --write    # fix: rewrite files in place
etf --stdin               # format stdin to stdout, silently (editor format-on-save)
etf --lsp                 # emit formatting diagnostics as JSON (editor squiggles)
```

Exits non-zero when a file needs formatting, so it drops straight into CI.
