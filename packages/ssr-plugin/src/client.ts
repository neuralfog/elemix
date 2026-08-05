import { Glob } from 'bun';
import { dirname } from 'node:path';
import { resolveCompiler } from './compiler';

const COMPILER = resolveCompiler();

const VIEW_CALL = /Reply\s*\.\s*view\s*\(\s*([A-Za-z_$][\w$]*)/g;
const DOCUMENT_REF = /\bdocument\s*[=(]\s*([A-Za-z_$][\w$]*)/g;

const SKIP = /\/(?:node_modules|dist|public|\.git)\//;

export const findViews = async (root = process.cwd()): Promise<string[]> => {
    const glob = new Glob('**/*.ts');
    const views = new Set<string>();
    const queue: string[] = [];

    const scan = async (file: string, source: string): Promise<void> => {
        const names = new Set<string>();
        for (const match of source.matchAll(VIEW_CALL)) names.add(match[1]);
        for (const match of source.matchAll(DOCUMENT_REF)) names.add(match[1]);
        for (const name of names) {
            const imported = new RegExp(
                `import[^;]*\\b${name}\\b[^;]*from\\s*['"]([^'"]+)['"]`,
            ).exec(source);
            const spec = imported?.[1];
            if (spec === undefined) continue;
            let path: string;
            try {
                path = Bun.resolveSync(spec, dirname(file));
            } catch {
                continue;
            }
            if (SKIP.test(path) || views.has(path)) continue;
            views.add(path);
            queue.push(path);
        }
    };

    for (const file of glob.scanSync({ cwd: root, absolute: true })) {
        if (SKIP.test(file)) continue;
        await scan(file, await Bun.file(file).text());
    }
    while (queue.length > 0) {
        const file = queue.shift() as string;
        await scan(file, await Bun.file(file).text());
    }
    return [...views];
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

export const clientPlugin: Bun.BunPlugin = {
    name: 'elemix-client',
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            const source = await Bun.file(args.path).text();
            if (args.path.includes('/node_modules/') || !needsCompile(source)) {
                return { contents: source, loader: 'ts' };
            }
            return { contents: await compileHydrate(source), loader: 'ts' };
        });
    },
};
