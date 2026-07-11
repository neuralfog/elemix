import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve('index.ts'),
                query: resolve('query.ts'),
                events: resolve('events.ts'),
            },
            name: 'elemix-testing-library',
            fileName: (format, entryName) =>
                `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
            formats: ['es', 'cjs'],
        },
        rollupOptions: {
            // @neuralfog/elemix is a peer dependency — consumers provide it,
            // so it must not be bundled into elemix-testing-library's dist.
            external: [/^@neuralfog\/elemix($|\/)/],
        },
    },
});
