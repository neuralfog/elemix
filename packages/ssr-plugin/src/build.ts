import { rmSync, watch } from 'node:fs';
import { clientPlugin, findViews } from './client';
import { ssrPlugin } from './plugin';
import { sassPlugin } from './sass';

export interface AppBuildOptions {
    root?: string;
    serverEntry?: string;
    serverOut?: string;
    clientOut?: string;
    minify?: boolean;
}

const SERVER_ENTRY = './src/index.ts';
const SERVER_OUT = './dist';
const CLIENT_OUT = './public/_elemix';

const report = (result: Bun.BuildOutput): boolean => {
    if (result.success) return true;
    for (const message of result.logs) console.error(message);
    return false;
};

type ClientResult = 'built' | 'empty' | 'failed';

const buildClient = async (opts: AppBuildOptions): Promise<ClientResult> => {
    const entrypoints = await findViews(opts.root);
    if (entrypoints.length === 0) return 'empty';
    const built = report(
        await Bun.build({
            entrypoints,
            outdir: opts.clientOut ?? CLIENT_OUT,
            target: 'browser',
            splitting: true,
            minify: opts.minify ?? false,
            naming: { entry: '[name].[ext]' },
            plugins: [clientPlugin, sassPlugin],
        }),
    );
    return built ? 'built' : 'failed';
};

const buildServer = (opts: AppBuildOptions): Promise<Bun.BuildOutput> =>
    Bun.build({
        entrypoints: [opts.serverEntry ?? SERVER_ENTRY],
        outdir: opts.serverOut ?? SERVER_OUT,
        target: 'bun',
        minify: opts.minify ?? true,
        sourcemap: 'external',
        plugins: [ssrPlugin, sassPlugin],
    });

export const build = async (opts: AppBuildOptions = {}): Promise<void> => {
    if (opts.minify ?? true) process.env.ELEMIX_SSR_MINIFY = '1';
    rmSync(opts.serverOut ?? SERVER_OUT, { recursive: true, force: true });
    rmSync(opts.clientOut ?? CLIENT_OUT, { recursive: true, force: true });
    if (!report(await buildServer(opts))) process.exit(1);
    const client = await buildClient({ ...opts, minify: opts.minify ?? true });
    if (client === 'failed') process.exit(1);
    const serverOut = opts.serverOut ?? SERVER_OUT;
    console.log(
        client === 'built'
            ? `Built to ${serverOut} + ${opts.clientOut ?? CLIENT_OUT}`
            : `Built to ${serverOut} (no views)`,
    );
};

export const dev = async (opts: AppBuildOptions = {}): Promise<void> => {
    const root = opts.root ?? process.cwd();
    const rebuild = async (): Promise<void> => {
        const result = await buildClient(opts);
        if (result === 'built') console.log('[client] hydrate assets rebuilt');
        else if (result === 'empty') console.log('[client] no views to build');
    };

    await rebuild();

    let pending: ReturnType<typeof setTimeout> | undefined;
    watch(`${root}/src`, { recursive: true }, (_event, filename) => {
        if (filename === null || !filename.endsWith('.ts')) return;
        clearTimeout(pending);
        pending = setTimeout(rebuild, 80);
    });

    Bun.spawn(['bun', 'run', '--watch', opts.serverEntry ?? SERVER_ENTRY], {
        stdio: ['inherit', 'inherit', 'inherit'],
    });
};
