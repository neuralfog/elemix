import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elemix } from '@neuralfog/elemix-vite';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const release = resolve(here, '..', 'target', 'release', 'elemix-compiler');
const debug = resolve(here, '..', 'target', 'debug', 'elemix-compiler');
const bin = existsSync(release) ? release : debug;

const fixtures = join(here, '..', 'fixtures');
type Component = { tag: string; fixture: string };
const manifest = JSON.parse(
    readFileSync(join(here, 'tests', 'components.json'), 'utf8'),
) as Component[];
const input = Object.fromEntries(
    manifest.map(({ tag, fixture }) => [tag, join(fixtures, `${fixture}.ts`)]),
);

export default defineConfig({
    plugins: [elemix({ bin })],
    build: {
        outDir: join(here, 'sharp', 'csr'),
        emptyOutDir: true,
        target: 'esnext',
        rollupOptions: {
            input,
            output: {
                entryFileNames: '[name]-[hash].js',
                chunkFileNames: '[name]-[hash].js',
                format: 'es',
            },
        },
    },
});
