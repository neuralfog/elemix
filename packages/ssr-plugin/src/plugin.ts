import { basename } from 'node:path';
import { injectMetadata, stampRouteFile } from './inject';

const COMPILER =
    process.env.ELEMIX_COMPILER ??
    `${import.meta.dir}/../../compiler/target/debug/elemix-compiler`;

const isComponent = (source: string): boolean =>
    source.includes('#component') || source.includes('tpl`');

const compileSsr = async (source: string): Promise<string> => {
    const proc = Bun.spawn([COMPILER, '--stdin', '--ssr'], {
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
        const root = process.cwd();
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            const source = await Bun.file(args.path).text();
            const outside =
                !args.path.startsWith(root) ||
                args.path.includes('/node_modules/');
            if (outside) return { contents: source, loader: 'ts' };

            const lowered = isComponent(source)
                ? await compileSsr(source)
                : source;
            const injected =
                injectMetadata(lowered, args.path)?.code ?? lowered;
            const name = basename(args.path).replace(/\.[tj]s$/, '');
            const stamped = stampRouteFile(injected, name);
            return { contents: stamped, loader: 'ts' };
        });
    },
};
