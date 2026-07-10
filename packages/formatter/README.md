# 🎀 Elemix Template Formatter ⚠️ **Experimental**

`etf` - a standalone formatter for the HTML inside ``tpl`...`

## Usage

```sh
# lint (default): print a diff of what would change, exit 1 if anything is unformatted
etf --dirs src

# fix: rewrite files in place
etf --dirs src --write
```

- `--dirs <DIR|GLOB>...` files/dirs/globs to scan (recursive for a dir)
- `--root <ROOT>` project root (config discovery), default `.`
- `--write` rewrite in place; default is lint/check
- `--check` explicit lint mode (also the default)
- `--print-width <N>` line width to wrap at (default `80`)
- `--tab-width <N>` spaces per indent level (default `4`)
- `--stdin` format source from stdin to stdout, silently (no banner) - for editor format-on-save
- `--lsp` read source from stdin, emit formatting diagnostics as JSON to stdout - for editor squiggles
