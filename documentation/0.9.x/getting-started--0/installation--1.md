# Installation

Install the runtime and the Vite build plugin:

```sh
npm i @neuralfog/elemix
npm i -D @neuralfog/elemix-vite
```

Add the plugin to your Vite config:

```ts
import { defineConfig } from 'vite';
import { elemix } from '@neuralfog/elemix-vite';

export default defineConfig({
    plugins: [elemix()],
});
```

That's it — write components with `tpl` and Vite compiles them as it loads each module.
