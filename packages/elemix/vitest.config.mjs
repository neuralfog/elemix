import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@neuralfog/elemix',
        root: './',
        environment: 'jsdom',
        maxWorkers: process.env.CI ? undefined : '25%',
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**/*.ts'],
            exclude: ['src/types.ts', 'src/**/*.types.ts'],
        },
    },
});
