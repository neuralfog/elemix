import { dirname, resolve } from 'node:path';
import { compile } from 'sass';

const NS = 'elemix-scss';

export const sassPlugin: Bun.BunPlugin = {
    name: 'elemix-sass',
    setup(build) {
        build.onResolve({ filter: /\.scss(\?inline)?$/ }, (args) => {
            const clean = args.path.replace(/\?inline$/, '');
            const path = args.importer
                ? resolve(dirname(args.importer), clean)
                : resolve(clean);
            return { path, namespace: NS };
        });
        build.onLoad({ filter: /.*/, namespace: NS }, (args) => {
            const { css } = compile(args.path);
            return {
                contents: `export default ${JSON.stringify(css)};`,
                loader: 'js',
            };
        });
    },
};
