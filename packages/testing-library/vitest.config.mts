import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elemix } from '@neuralfog/elemix-vite';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const bin = resolve(here, '../compiler/target/debug/elemix-compiler');

export default defineConfig({
    plugins: [elemix({ bin })],
    test: {
        name: 'unit',
        environment: 'jsdom',
        globals: true,
        include: ['test/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**/*.ts'],
        },
    },
});
