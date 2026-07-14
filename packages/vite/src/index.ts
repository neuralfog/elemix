import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

// Every elemix compiler hint. A file is compiled if it carries ANY of them, so
// this list IS the gate — drop one and that pragma silently bleeds through
// uncompiled (a module-level `// #state` store would stay a dead plain object).
export const PRAGMAS = [
    'component',
    'tag',
    'form',
    'no-shadow',
    'shadow',
    'styles',
    'state',
    'effect',
    'before-mount',
    'mount',
    'dispose',
] as const;

const PRAGMA = new RegExp(`^\\s*//\\s*#(${PRAGMAS.join('|')})\\b`, 'm');

/**
 * Whether a module needs the elemix compiler run on it: it has a `tpl` template,
 * or any pragma comment (including a template-less `// #state` store / pragma
 * component). Exported so the gate stays under test for every pragma.
 */
export const needsCompile = (code: string): boolean =>
    code.includes('tpl`') || PRAGMA.test(code);

// Resolve the host's prebuilt `elemix-compiler` binary from its platform package
// (the same scheme the `ec` launcher uses).
const resolveBin = (): string => {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const pkg = `@neuralfog/elemix-compiler-${process.platform}-${process.arch}`;
    const pkgJson = require.resolve(`${pkg}/package.json`);
    return join(dirname(pkgJson), `elemix-compiler${ext}`);
};

// A Source Map v3 object (only the fields we touch are typed).
interface SourceMap {
    version: 3;
    sources: string[];
    sourcesContent?: string[];
    mappings: string;
    [key: string]: unknown;
}

interface Compiled {
    code: string;
    map: SourceMap;
}

// Pipe one module's source through `elemix-compiler --stdin --sourcemap`, which
// answers with a `{ code, map }` JSON envelope. Returning the map keeps the
// source-map chain intact — Vite composes it with esbuild's TS→JS map so
// breakpoints / stack traces resolve to the original `tpl` source.
const compile = (bin: string, source: string): Promise<Compiled> =>
    new Promise((resolve, reject) => {
        const child = spawn(bin, ['--stdin', '--sourcemap']);
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
            if (code !== 0) {
                reject(new Error(err || `elemix-compiler exited with ${code}`));
                return;
            }
            try {
                resolve(JSON.parse(out) as Compiled);
            } catch (e) {
                reject(
                    new Error(`elemix-compiler: bad output envelope (${e})`),
                );
            }
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
            if (
                file.includes('/node_modules/') ||
                !file.endsWith('.ts') ||
                file.endsWith('.d.ts')
            ) {
                return null;
            }
            if (!needsCompile(code)) {
                return null;
            }
            if (!bin) bin = resolveBin();
            const { code: compiled, map } = await compile(bin, code);
            // The compiler emits a placeholder source name; point it at the
            // real module so Vite resolves the original file in devtools.
            map.sources = [id];
            return { code: compiled, map };
        },
    };
};

export default elemix;
