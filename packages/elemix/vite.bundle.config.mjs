import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
const filename = `elemix-v${version}.js`;

export default defineConfig({
    build: {
        lib: {
            entry: resolve('bundle.entry.ts'),
            name: 'elemix',
            fileName: () => filename,
            formats: ['es'],
        },
        outDir: 'bundle',
    },
    plugins: [
        {
            name: 'esbuild-minify',
            async generateBundle(_, bundle) {
                const chunk = bundle[filename];
                if (chunk?.type === 'chunk') {
                    const result = await transform(chunk.code, {
                        minify: true,
                        loader: 'js',
                    });
                    chunk.code = result.code;
                }
            },
        },
    ],
});
