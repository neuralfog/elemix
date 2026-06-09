import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@neuralfog/elemix:render-cost',
        root: './',
        environment: 'jsdom',
        setupFiles: ['vitest.setup.mjs'],
        include: ['render-cost.harness.ts'],
        disableConsoleIntercept: true,
    },
});
