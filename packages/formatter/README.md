<img src="https://raw.githubusercontent.com/neuralfog/elemix/main/.readme/elemix-banner.svg" alt="elemix - Reactive Elements" width="100%" />

# Elemix template formatter

`etf` - a standalone formatter for `tpl` templates.

## Usage

Install as a dev dependency:

```sh
pnpm add -D @neuralfog/elemix-template-formatter
```

Run it from your package scripts:

```json
"scripts": {
  "lint:tpl": "etf --dirs src",
  "lint:tpl:fix": "etf --dirs src --write"
}
```

```sh
pnpm lint:tpl       # check: exit 1 if anything is unformatted
pnpm lint:tpl:fix   # fix: rewrite in place
```

## Configuration

Config is read from an `elemix.toml` file at your project root:

```toml
[formatter]
enabled = true           # false turns the formatter off entirely
indent_style = "space"   # "space" (default) or "tab"
indent_width = 4         # columns per indent level
line_width = 80          # max line width
```

The full setup is shown in the [elemix template](https://github.com/neuralfog/elemix-template).
