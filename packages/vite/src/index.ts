import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

// Resolve the host's prebuilt `elemix-compiler` binary from its platform package
// (the same scheme the `ec` launcher uses).
const resolveBin = (): string => {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const pkg = `@neuralfog/elemix-compiler-${process.platform}-${process.arch}`;
    const pkgJson = require.resolve(`${pkg}/package.json`);
    return join(dirname(pkgJson), `elemix-compiler${ext}`);
};

// Pipe one module's source through `elemix-compiler --stdin` → compiled `.ts`.
const compile = (bin: string, source: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const child = spawn(bin, ['--stdin']);
        let out = '';
        let err = '';
        child.stdout.on('data', (chunk) => {
            out += chunk;
        });
        child.stderr.on('data', (chunk) => {
            err += chunk;
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve(out);
            else
                reject(new Error(err || `elemix-compiler exited with ${code}`));
        });
        child.stdin.end(source);
    });

export interface ElemixPluginOptions {
    /** Path to the `elemix-compiler` binary. Defaults to the installed one. */
    bin?: string;
}

/**
 * Vite plugin — lower elemix `tpl` templates to compiled `view()` on the fly,
 * via the native `elemix-compiler` binary. Runs `pre`, before Vite transpiles
 * TS to JS, so authoring stays `tpl`...`` and the compile step is invisible.
 */
export const elemix = (options: ElemixPluginOptions = {}): Plugin => {
    let bin = options.bin;
    return {
        name: 'elemix',
        enforce: 'pre',
        async transform(code, id) {
            const file = id.split('?', 1)[0];
            if (file.includes('/node_modules/') || !file.endsWith('.ts')) {
                return null;
            }
            if (file.endsWith('.d.ts') || !code.includes('tpl`')) return null;
            if (!bin) bin = resolveBin();
            return { code: await compile(bin, code), map: null };
        },
    };
};

export default elemix;
