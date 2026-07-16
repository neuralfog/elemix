<img src="https://raw.githubusercontent.com/neuralfog/elemix/main/.readme/elemix-banner.png" alt="elemix - Reactive Elements" width="100%" />

# Elemix extension for vscode

## Features

- Syntax highlighting for `tpl` templates.
- Prop typechecking diagnostics: prop type mismatches, missing required props, unknown props, duplicated props.
- Compiler hint validation.
- Completion: `:prop` component context aware, `@event`, `~model`/`~onmodel`.
- Completion: compiler hints `// #...`.
- Completion: components tags with default props inlined.
- Hover: compiler hints docs.
- Hover: component tags listing props.
- Code actions: auto-import a used-but-unimported component.
- Code actions: format templates.
- Resolves `elemix-analyzer` and `elemix-template-formatter` from your project's `node_modules`.

## Commands (CTRL + SHIFT + P)

- `elemix: Restart LSP` - restart lsp server.
- `elemix: Format templates in file` - format elemix file.
- `elemix: Format on save` - toggle format-on-save for current project.

### Formatter config

Formatter config is read from an `elemix.toml` file at your project root, not from editor settings. Create one to change the defaults:

```toml
[formatter]
enabled = true           # false turns the formatter off entirely
indent_style = "space"   # "space" (default) or "tab"
indent_width = 4         # columns per indent level
line_width = 80          # max line width
```