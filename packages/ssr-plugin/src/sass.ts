import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileString, type Importer } from 'sass';

const NS = 'elemix-scss';

const isRelative = (spec: string): boolean =>
    spec.startsWith('.') || spec.startsWith('/');

const findImports = (
    fromDir: string,
): { dir: string; imports: Record<string, unknown> } | null => {
    let dir = fromDir;
    for (;;) {
        try {
            const json = JSON.parse(
                readFileSync(join(dir, 'package.json'), 'utf8'),
            );
            if (json.imports) return { dir, imports: json.imports };
        } catch {}
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
};

export const resolveAlias = (spec: string, fromDir: string): string | null => {
    const found = findImports(fromDir);
    if (!found) return null;
    for (const [pattern, target] of Object.entries(found.imports)) {
        if (typeof target !== 'string') continue;
        if (pattern.endsWith('*') && target.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            if (spec.startsWith(prefix)) {
                return resolve(
                    found.dir,
                    target.slice(0, -1) + spec.slice(prefix.length),
                );
            }
        } else if (pattern === spec) {
            return resolve(found.dir, target);
        }
    }
    return null;
};

const ALIAS_RE = /(@(?:use|forward|import)\s+['"])([^'"]+)(['"])/g;

export const rewriteAliases = (source: string, fromDir: string): string =>
    source.replace(ALIAS_RE, (match, pre, spec, post) => {
        if (isRelative(spec)) return match;
        const resolved = resolveAlias(spec, fromDir);
        if (!resolved) return match;
        let rel = relative(fromDir, resolved).split('\\').join('/');
        if (!rel.startsWith('.')) rel = `./${rel}`;
        return `${pre}${rel}${post}`;
    });

const resolveFile = (path: string): string | null => {
    const dir = dirname(path);
    const name = basename(path);
    const candidates = [
        path,
        `${path}.scss`,
        join(dir, `_${name}.scss`),
        join(path, '_index.scss'),
        join(path, 'index.scss'),
    ];
    return candidates.find((c) => existsSync(c)) ?? null;
};

const scssImporter: Importer<'sync'> = {
    canonicalize(url) {
        const path = url.startsWith('file:') ? fileURLToPath(url) : url;
        const file = resolveFile(path);
        return file ? pathToFileURL(file) : null;
    },
    load(canonicalUrl) {
        const path = fileURLToPath(canonicalUrl);
        return {
            contents: rewriteAliases(readFileSync(path, 'utf8'), dirname(path)),
            syntax: 'scss',
        };
    },
};

export const compileScssFile = (path: string): string => {
    const source = rewriteAliases(readFileSync(path, 'utf8'), dirname(path));
    return compileString(source, {
        url: pathToFileURL(path),
        importer: scssImporter,
    }).css;
};

export const sassPlugin: Bun.BunPlugin = {
    name: 'elemix-sass',
    setup(build) {
        build.onResolve({ filter: /\.scss(\?inline)?$/ }, (args) => {
            const clean = args.path.replace(/\?inline$/, '');
            const base = args.importer ? dirname(args.importer) : process.cwd();
            const path = isRelative(clean)
                ? resolve(base, clean)
                : (resolveAlias(clean, base) ?? resolve(base, clean));
            return { path, namespace: NS };
        });
        build.onLoad({ filter: /.*/, namespace: NS }, (args) => ({
            contents: `export default ${JSON.stringify(compileScssFile(args.path))};`,
            loader: 'js',
        }));
    },
};
