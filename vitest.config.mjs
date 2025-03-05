import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@neuralfog/elemix',
        root: './',
        environment: 'jsdom',
        setupFiles: ['vitest.setup.mjs'],
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**/*.ts'],
            exclude: ['src/types.ts', 'src/**/*.types.ts'],
        },
    },
});
