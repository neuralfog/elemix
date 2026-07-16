<img src="https://raw.githubusercontent.com/neuralfog/elemix/main/.readme/elemix-banner.svg" alt="elemix - Reactive Elements" width="100%" />

# Elemix compiler plugin for vite

## Installation

Needs Vite 5+.

1. Install the plugin (the compiler ships as its dependency):

   ```sh
   pnpm add -D @neuralfog/elemix-vite
   ```

2. Add it to your Vite config:

   ```ts
   import { defineConfig } from 'vite';
   import { elemix } from '@neuralfog/elemix-vite';

   export default defineConfig({
     plugins: [elemix()],
   });
   ```

The full setup is shown in the [elemix template](https://github.com/neuralfog/elemix-template).
