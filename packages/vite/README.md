# ⚡ @neuralfog/elemix-vite ⚠️ **Experimental**

Vite plugin that compiles [elemix](https://www.npmjs.com/package/@neuralfog/elemix)
`tpl` templates to `view()` on the fly — authoring stays `tpl`...``, the compile
step is invisible.

It runs `pre` (before Vite transpiles TS to JS) and drives the native
`elemix-compiler` binary in `--stdin` mode, one compile per module.

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { elemix } from '@neuralfog/elemix-vite';

export default defineConfig({
    plugins: [elemix()],
});
```

That's it — write components with `tpl` and Vite compiles them as it loads each
`.ts` module.
