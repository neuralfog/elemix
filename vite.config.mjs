import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: [
                resolve('index.ts'),
                resolve('decorators.ts'),
                resolve('directives.ts'),
                resolve('reactive.ts'),
                resolve('signal.ts'),
                resolve('app.ts'),
                resolve('utilities.ts'),
            ],
            name: 'elemix',
            fileName: (_, entryName) => `${entryName}.js`,
            formats: ['cjs'],
        },
        rollupOptions: {
            external: ['@neuralfog/elemix-renderer'],
        },
    },
});
