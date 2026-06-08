import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: [resolve('index.ts')],
            name: 'elemix-storybook',
            fileName: (_, entryName) => `${entryName}.js`,
            formats: ['cjs'],
        },
        rollupOptions: {
            // @neuralfog/elemix is a peer dependency — consumers provide it,
            // so it must not be bundled into elemix-storybook's dist.
            external: [/^@neuralfog\/elemix($|\/)/],
        },
    },
});
