import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'unit',
        environment: 'jsdom',
        globals: true,
        maxWorkers: process.env.CI ? undefined : '25%',
        include: ['src/**/*.{test,spec}.ts'],
    },
});
