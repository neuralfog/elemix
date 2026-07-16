<img src="https://raw.githubusercontent.com/neuralfog/elemix/main/.readme/elemix-banner.svg" alt="elemix - Reactive Elements" width="100%" />

# Elemix analyzer

`ea` - static analysis for `tpl` templates.

## Usage

Install as a dev dependency:

```sh
pnpm add -D @neuralfog/elemix-analyzer
```

Run it from your package scripts:

```json
"scripts": {
  "lint:analyze": "ea --dirs src --root ."
}
```

```sh
pnpm lint:analyze
```

The full setup is shown in the [elemix template](https://github.com/neuralfog/elemix-template).
