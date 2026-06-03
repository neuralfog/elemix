import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve('index.ts'),
                decorators: resolve('decorators.ts'),
                directives: resolve('directives.ts'),
                reactive: resolve('reactive.ts'),
                render: resolve('render.ts'),
                signal: resolve('signal.ts'),
                app: resolve('app.ts'),
                utilities: resolve('utilities.ts'),
                'testing/index': resolve('testing/index.ts'),
                'testing/snapshots': resolve('testing/snapshots.ts'),
                'testing/mocks': resolve('testing/mocks.ts'),
            },
            name: 'elemix',
            fileName: (_, entryName) => `${entryName}.js`,
            formats: ['cjs'],
        },
    },
});
