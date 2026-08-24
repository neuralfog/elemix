import { basename } from 'node:path';
import { needsCompile, runCompiler } from './compiler';
import { injectMetadata, stampModule, stampRouteFile } from './inject';

export const ssrPlugin: Bun.BunPlugin = {
    name: 'elemix-ssr',
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            const source = await Bun.file(args.path).text();
            if (args.path.includes('/node_modules/')) {
                return { contents: source, loader: 'ts' };
            }

            const lowered = needsCompile(source)
                ? await runCompiler(source, '--ssr')
                : source;
            const injected = injectMetadata(lowered)?.code ?? lowered;
            const name = basename(args.path).replace(/\.[tj]s$/, '');
            const stamped = stampModule(stampRouteFile(injected, name), name);
            return { contents: stamped, loader: 'ts' };
        });
    },
};
