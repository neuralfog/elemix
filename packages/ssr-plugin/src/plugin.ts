import { basename } from 'node:path';
import { resolveCompiler } from './compiler';
import { injectMetadata, stampModule, stampRouteFile } from './inject';

const COMPILER = resolveCompiler();

const needsCompile = (source: string): boolean =>
    source.includes('#component') ||
    source.includes('tpl`') ||
    source.includes('#state') ||
    source.includes('#store');

const compileSsr = async (source: string): Promise<string> => {
    const args = ['--stdin', '--ssr'];
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

export const ssrPlugin: Bun.BunPlugin = {
    name: 'elemix-ssr',
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            const source = await Bun.file(args.path).text();
            if (args.path.includes('/node_modules/')) {
                return { contents: source, loader: 'ts' };
            }

            const lowered = needsCompile(source)
                ? await compileSsr(source)
                : source;
            const injected = injectMetadata(lowered)?.code ?? lowered;
            const name = basename(args.path).replace(/\.[tj]s$/, '');
            const stamped = stampModule(stampRouteFile(injected, name), name);
            return { contents: stamped, loader: 'ts' };
        });
    },
};
