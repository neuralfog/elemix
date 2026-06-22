# 🚦 Elemix Analyzer ⚠️ **Experimental**

Static analysis for [Elemix](https://www.npmjs.com/package/@neuralfog/elemix) — the checks `tsc` can't do on its own (a template hole is an opaque string to it) and the custom-element pitfalls that fail silently at runtime.

Ships a prebuilt native binary; needs **node** + the project's **typescript** (type judgment is delegated to your own `tsc`, so verdicts match your editor).

## Usage

Installs two commands — `ea` (short) and `elemix-analyzer`:

```sh
ea --dirs <dir|glob>... --root <project>
ea --dirs src --lsp          # LSP-shaped JSON diagnostics
```
