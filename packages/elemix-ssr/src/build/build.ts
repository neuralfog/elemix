import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { collectMeta, optimiserSource, type ChildMeta } from './optimiser';
import { compileString } from 'sass';
import { sassPlugin } from './sass';

type View = { key: string; source: string; export?: string | null };

const noColor = !process.stdout.isTTY || process.env.NO_COLOR !== undefined;
const paint = (code: string, s: string): string =>
    noColor ? s : `\x1b[${code}m${s}\x1b[0m`;
const violet = (s: string): string => paint('38;2;167;139;250', s);
const dim = (s: string): string => paint('38;2;110;118;129', s);
const green = (s: string): string => paint('38;2;74;222;128', s);
const cyan = (s: string): string => paint('38;2;34;211;238', s);
const white = (s: string): string => paint('38;2;244;244;245', s);
const BAR = violet('▐▌');
const tagged = (tag: string, path: string): void =>
    console.log(`  ${tag} ${dim(path)}`);
const logError = (message: string): void =>
    console.error(`  ${BAR}  ${message}`);

const NAV_IMPORT = "import '@neuralfog/elemix-ssr/navigation';";

const devBinary = (root: string): string | null => {
    let dir = root;
    for (;;) {
        const target = join(dir, 'compiler', 'target');
        const release = join(target, 'release', 'elemix-compiler');
        const debug = join(target, 'debug', 'elemix-compiler');
        const rt = existsSync(release) ? statSync(release).mtimeMs : -1;
        const dt = existsSync(debug) ? statSync(debug).mtimeMs : -1;
        if (rt >= 0 || dt >= 0) return rt >= dt ? release : debug;
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
};

const minifyCss = (css: string): string =>
    css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,>])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();

const resetStyles = (root: string): string | null => {
    const candidates = [
        join(root, 'Views', 'Scss', 'reset.scss'),
        join(root, 'Views', 'Scss', 'reset.css'),
        join(root, 'reset.scss'),
        join(root, 'reset.css'),
    ];
    for (const path of candidates) {
        if (!existsSync(path)) continue;
        return minifyCss(compileString(readFileSync(path, 'utf8')).css);
    }
    return null;
};

const platformPackage = (root: string): string | null => {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const pkg = `@neuralfog/elemix-compiler-${process.platform}-${process.arch}`;
    try {
        return join(
            dirname(Bun.resolveSync(`${pkg}/package.json`, root)),
            `elemix-compiler${ext}`,
        );
    } catch {
        return null;
    }
};

export const build = async (
    viewsJson: string,
    outputRoot: string,
): Promise<number> => {
    const compiler =
        process.env.ELEMIX_COMPILER ??
        devBinary(outputRoot) ??
        platformPackage(outputRoot);
    if (!compiler) {
        logError(
            'elemix-compiler not found (build packages/compiler, or install @neuralfog/elemix-compiler-<platform>)',
        );
        return 1;
    }

    const runCompiler = async (
        source: string,
        mode: '--ssr' | '--hydrate',
    ): Promise<string> => {
        const proc = Bun.spawn([compiler, '--stdin', mode], {
            stdin: Buffer.from(source),
            stdout: 'pipe',
            stderr: 'inherit',
        });
        const code = await new Response(proc.stdout).text();
        await proc.exited;
        return code;
    };

    const MARKERS = ['#component', '#document', 'tpl`', '#state', '#store'];
    const optimiserEnabled = process.env.ELEMIX_OPTIMISE === '1';
    const compiledCache = new Map<string, string>();
    const registry = new Map<string, ChildMeta>();
    const optimised = new Set<string>();
    const compileCached = async (path: string): Promise<string> => {
        const hit = compiledCache.get(path);
        if (hit !== undefined) return hit;
        const src = await Bun.file(path).text();
        const needs = MARKERS.some((m) => src.includes(m));
        const code = needs ? await runCompiler(src, '--ssr') : src;
        compiledCache.set(path, code);
        if (needs)
            for (const meta of collectMeta(code)) registry.set(meta.tag, meta);
        return code;
    };

    const elemixLoader = (mode: '--ssr' | '--hydrate'): Bun.BunPlugin => ({
        name: `elemix${mode}`,
        setup(build) {
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
                const source = await Bun.file(args.path).text();
                if (args.path.includes('/node_modules/')) {
                    return { contents: source, loader: 'ts' };
                }
                const needs = MARKERS.some((m) => source.includes(m));
                if (mode === '--hydrate') {
                    return {
                        contents: needs
                            ? await runCompiler(source, '--hydrate')
                            : source,
                        loader: 'ts',
                    };
                }
                const compiled = await compileCached(args.path);
                if (!needs || !optimiserEnabled)
                    return { contents: compiled, loader: 'ts' };
                const result = optimiserSource(compiled, registry);
                if (result.inlined > 0 && !optimised.has(args.path)) {
                    optimised.add(args.path);
                    console.log(
                        `  ${cyan('[ssr]')} ${dim(relative(outputRoot, args.path))} ${green('optimised')}`,
                    );
                }
                return { contents: result.code, loader: 'ts' };
            });
        },
    });

    const views: View[] = JSON.parse(await Bun.file(viewsJson).text());
    rmSync(join(outputRoot, 'ssr'), { recursive: true, force: true });
    rmSync(join(outputRoot, 'public', '_elemix'), {
        recursive: true,
        force: true,
    });
    const temp = join(outputRoot, '.hydris-build');
    mkdirSync(temp, { recursive: true });

    let failed = 0;
    let hydrateCount = 0;

    const reset = resetStyles(outputRoot);
    const resetImport = reset === null ? 'render' : 'render, $__setResetStyles';
    const resetCall =
        reset === null ? '' : `$__setResetStyles(${JSON.stringify(reset)});\n`;

    const ssr = elemixLoader('--ssr');

    if (optimiserEnabled) {
        const discoverEntry = join(temp, 'discover.entry.ts');
        writeFileSync(
            discoverEntry,
            `${views.map((v) => `import ${JSON.stringify(v.source)};`).join('\n')}\n`,
        );
        const register: Bun.BunPlugin = {
            name: 'elemix-register',
            setup(build) {
                build.onLoad({ filter: /\.ts$/ }, async (args) => {
                    if (args.path.includes('/node_modules/'))
                        return {
                            contents: await Bun.file(args.path).text(),
                            loader: 'ts',
                        };
                    return {
                        contents: await compileCached(args.path),
                        loader: 'ts',
                    };
                });
            },
        };
        await Bun.build({
            entrypoints: [discoverEntry],
            plugins: [register, sassPlugin],
            format: 'iife',
            target: 'browser',
        });
    }

    for (const view of views) {
        const entry = join(
            temp,
            `${view.key.replace(/[/\\@]/g, '_')}.entry.ts`,
        );
        const exportName = view.export ?? basename(view.source, '.ts');
        const pick = `(page as Record<string, unknown>)[${JSON.stringify(exportName)}] ?? (page as Record<string, unknown>).default ?? Object.values(page).find((e) => typeof e === 'function')`;
        writeFileSync(
            entry,
            `import { ${resetImport} } from '@neuralfog/elemix-ssr';\n${NAV_IMPORT}\nimport * as page from ${JSON.stringify(view.source)};\n${resetCall}const view = ${pick};\nglobalThis.render = (ctx?: unknown) => render(view as never, ctx as never);\n`,
        );
        const result = await Bun.build({
            entrypoints: [entry],
            plugins: [ssr, sassPlugin],
            format: 'iife',
            target: 'browser',
        });
        if (!result.success) {
            logError(`ssr ${view.key} failed`);
            for (const message of result.logs) console.error(message);
            failed++;
            continue;
        }
        const out = join(outputRoot, 'ssr', `${view.key}.js`);
        mkdirSync(dirname(out), { recursive: true });
        const code = await result.outputs[0].text();
        writeFileSync(out, code);
    }

    const hydrate = elemixLoader('--hydrate');
    const clientDir = join(outputRoot, 'public', '_elemix');
    mkdirSync(clientDir, { recursive: true });
    const manifest: Record<string, string> = {};

    const clientEntries = views.map((view) => {
        const name = view.key.replace(/[/\\@]/g, '_');
        const entry = join(temp, `${name}.client.ts`);
        writeFileSync(
            entry,
            `${NAV_IMPORT}\nimport ${JSON.stringify(view.source)};\n`,
        );
        return { key: view.key, entry, name: `${name}.client` };
    });

    const client = await Bun.build({
        entrypoints: clientEntries.map((e) => e.entry),
        outdir: clientDir,
        target: 'browser',
        format: 'esm',
        splitting: true,
        naming: {
            entry: '[name]-[hash].[ext]',
            chunk: '[name]-[hash].[ext]',
            asset: '[name]-[hash].[ext]',
        },
        plugins: [hydrate, sassPlugin],
    });

    if (!client.success) {
        logError('client build failed');
        for (const message of client.logs) console.error(message);
        failed++;
    } else {
        console.log('');
        const entries = client.outputs.filter((o) => o.kind === 'entry-point');
        for (const ce of clientEntries) {
            const entry = entries.find((o) =>
                basename(o.path).startsWith(`${ce.name}-`),
            );
            if (entry === undefined) {
                logError(`client ${ce.key}: no entry output`);
                failed++;
                continue;
            }
            manifest[ce.key] = basename(entry.path);
            tagged(
                white('[hydration]'),
                `public/_elemix/${basename(entry.path)}`,
            );
            hydrateCount++;
        }
        for (const output of client.outputs) {
            if (output.kind === 'chunk') {
                tagged(
                    white('[hydration]'),
                    `public/_elemix/${basename(output.path)}`,
                );
                hydrateCount++;
            }
        }
        writeFileSync(
            join(clientDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2),
        );
    }

    rmSync(temp, { recursive: true, force: true });
    writeFileSync(
        join(outputRoot, '.hydris-stats.json'),
        JSON.stringify({
            views: views.length,
            optimised: optimised.size,
            hydrate: hydrateCount,
        }),
    );
    return failed > 0 ? 1 : 0;
};
