import { Glob } from 'bun';
import { dirname, resolve } from 'node:path';
import { resolveCompiler } from './compiler';

const COMPILER = resolveCompiler();

const VIEW_CALL = /Reply\s*\.\s*view\s*\(\s*([A-Za-z_$][\w$]*)/g;

const SKIP = /\/(?:node_modules|dist|public|\.git)\//;

export const findViews = async (root = process.cwd()): Promise<string[]> => {
    const glob = new Glob('**/*.ts');
    const views = new Set<string>();
    for (const file of glob.scanSync({ cwd: root, absolute: true })) {
        if (SKIP.test(file)) continue;
        const source = await Bun.file(file).text();
        const names = new Set<string>();
        for (const match of source.matchAll(VIEW_CALL)) names.add(match[1]);
        for (const name of names) {
            const imported = new RegExp(
                `import[^;]*\\b${name}\\b[^;]*from\\s*['"]([^'"]+)['"]`,
            ).exec(source);
            const spec = imported?.[1];
            if (spec === undefined || !spec.startsWith('.')) continue;
            const path = resolve(dirname(file), spec);
            views.add(/\.[tj]s$/.test(path) ? path : `${path}.ts`);
        }
    }
    return [...views];
};

const needsCompile = (source: string): boolean =>
    source.includes('#component') ||
    source.includes('tpl`') ||
    source.includes('#state');

const compileHydrate = async (source: string): Promise<string> => {
    const proc = Bun.spawn([COMPILER, '--stdin', '--hydrate'], {
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
