import { dirname } from 'node:path';
import { Glob } from 'bun';
import { resolveCompiler } from './compiler';

const COMPILER = resolveCompiler();

const VIEW_CALL = /Reply\s*\.\s*view\s*\(\s*([A-Za-z_$][\w$]*)/g;
const DOCUMENT_REF = /\bdocument\s*[=(]\s*([A-Za-z_$][\w$]*)/g;

const SKIP = /\/(?:node_modules|dist|public|\.git)\//;

export type Views = { pages: string[]; documents: string[] };

export const findViews = async (root = process.cwd()): Promise<Views> => {
    const glob = new Glob('**/*.ts');
    const pages = new Set<string>();
    const documents = new Set<string>();
    const queue: string[] = [];

    const scan = async (file: string, source: string): Promise<void> => {
        const add = (name: string, into: Set<string>): void => {
            const imported = new RegExp(
                `import[^;]*\\b${name}\\b[^;]*from\\s*['"]([^'"]+)['"]`,
            ).exec(source);
            const spec = imported?.[1];
            if (spec === undefined) return;
            let path: string;
            try {
                path = Bun.resolveSync(spec, dirname(file));
            } catch {
                return;
            }
            if (SKIP.test(path) || pages.has(path) || documents.has(path))
                return;
            into.add(path);
            queue.push(path);
        };
        for (const match of source.matchAll(VIEW_CALL)) add(match[1], pages);
        for (const match of source.matchAll(DOCUMENT_REF))
            add(match[1], documents);
    };

    for (const file of glob.scanSync({ cwd: root, absolute: true })) {
        if (SKIP.test(file)) continue;
        await scan(file, await Bun.file(file).text());
    }
    while (queue.length > 0) {
        const file = queue.shift() as string;
        await scan(file, await Bun.file(file).text());
    }
    return { pages: [...pages], documents: [...documents] };
};

const needsCompile = (source: string): boolean =>
    source.includes('#component') ||
    source.includes('tpl`') ||
    source.includes('#state');

const compileHydrate = async (source: string): Promise<string> => {
    const args = ['--stdin', '--hydrate'];
    if (process.env.ELEMIX_SSR_MINIFY === '1') args.push('--minify');
    const proc = Bun.spawn([COMPILER, ...args], {
        stdin: Buffer.from(source),
        stdout: 'pipe',
        stderr: 'inherit',
    });
    const code = await new Response(proc.stdout).text();
    await proc.exited;
    return code;
};

const HYDRIS_CLIENT_SHIM =
    'export const asset = (p) => p;\n' +
    "export const fontFace = () => '';\n" +
    "export const fontFaces = () => '';\n";

export const clientPlugin = (views: Views): Bun.BunPlugin => {
    const pages = new Set(views.pages);
    const docImports = views.documents
        .map((d) => `import ${JSON.stringify(d)};`)
        .join('\n');
    return {
        name: 'elemix-client',
        setup(build) {
            build.onResolve({ filter: /^@neuralfog\/hydris$/ }, () => ({
                path: '@neuralfog/hydris',
                namespace: 'hydris-client-shim',
            }));
            build.onLoad(
                { filter: /.*/, namespace: 'hydris-client-shim' },
                () => ({ contents: HYDRIS_CLIENT_SHIM, loader: 'js' }),
            );
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
                const source = await Bun.file(args.path).text();
                const compiled =
                    args.path.includes('/node_modules/') ||
                    !needsCompile(source)
                        ? source
                        : await compileHydrate(source);
                const contents =
                    pages.has(args.path) && docImports
                        ? `${compiled}\n${docImports}`
                        : compiled;
                return { contents, loader: 'ts' };
            });
        },
    };
};
