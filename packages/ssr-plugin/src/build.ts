import { rmSync, watch } from 'node:fs';
import { clientPlugin, findViews } from './client';
import { ssrPlugin } from './plugin';
import { sassPlugin } from './sass';

export type AppBuildOptions = {
    root?: string;
    serverEntry?: string;
    serverOut?: string;
    clientOut?: string;
    minify?: boolean;
};

type DevMessage = {
    __hydris_dev__?: { watch?: string };
};

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
    const entry = opts.serverEntry ?? SERVER_ENTRY;

    const rebuild = async (): Promise<void> => {
        const result = await buildClient(opts);
        if (result === 'built') console.log('[client] hydrate assets rebuilt');
        else if (result === 'empty') console.log('[client] no views to build');
    };

    let watching = false;
    let queued: Promise<void> = Promise.resolve();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const startWatch = (dir: string): void => {
        if (watching) return;
        watching = true;
        watch(`${root}/${dir}`, { recursive: true }, () => {
            clearTimeout(pending);
            pending = setTimeout(() => {
                queued = queued
                    .then(() => rebuild())
                    .then(() => restartServer())
                    .catch((err) =>
                        console.error('[dev] rebuild failed:', err),
                    );
            }, 120);
        });
    };

    let server: Bun.Subprocess | undefined;
    const startServer = (): void => {
        server = Bun.spawn(['bun', entry], {
            ipc(message: DevMessage) {
                const watchDir = message.__hydris_dev__?.watch;
                if (watchDir !== undefined) startWatch(watchDir);
            },
            stdio: ['inherit', 'inherit', 'inherit'],
        });
    };
    const restartServer = async (): Promise<void> => {
        if (server) {
            server.kill('SIGKILL');
            await server.exited;
        }
        startServer();
    };

    await rebuild();
    startServer();

    const killServer = (): void => {
        server?.kill('SIGKILL');
    };
    const stop = (): void => {
        killServer();
        process.exit(0);
    };
    const die = (err: unknown): void => {
        console.error(err);
        killServer();
        process.exit(1);
    };
    process.on('exit', killServer);
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    process.on('SIGHUP', stop);
    process.on('uncaughtException', die);
    process.on('unhandledRejection', die);
};
