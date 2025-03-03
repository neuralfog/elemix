import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@brownhounds/wc-micro',
        root: './',
        environment: 'jsdom',
        setupFiles: ['vitest.setup.mjs'],
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**/*.ts'],
            exclude: ['src/types.ts', 'src/**/*.types.ts'],
            lines: 100,
            functions: 100,
            branches: 100,
            statements: 100,
        },
    },
});
