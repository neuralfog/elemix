import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve('index.ts'),
                runtime: resolve('runtime.ts'),
                directives: resolve('directives.ts'),
            },
            name: 'elemix',
            fileName: (format, entryName) =>
                `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
            formats: ['es', 'cjs'],
        },
    },
});
