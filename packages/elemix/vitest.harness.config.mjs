import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@neuralfog/elemix:render-cost',
        root: './',
        environment: 'jsdom',
        include: ['render-cost.harness.ts'],
        disableConsoleIntercept: true,
    },
});
