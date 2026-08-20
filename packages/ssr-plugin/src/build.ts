import { rmSync, watch } from 'node:fs';
import { clientPlugin, findViews } from './client';
import { log, logError } from './log';
import { ssrPlugin } from './plugin';
import { sassPlugin } from './sass';

export type AppBuildOptions = {
    root?: string;
    serverEntry?: string;
    serverOut?: string;
    clientOut?: string;
    host?: string;
    minify?: boolean;
};

type DevMessage = {
    __hydris_dev__?: { watch?: string; ready?: boolean };
};

const clearScreen = (): void => {
    if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
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
    log(
        client === 'built'
            ? `built ${serverOut} + ${opts.clientOut ?? CLIENT_OUT}`
            : `built ${serverOut} (no views)`,
    );
};

export const dev = async (opts: AppBuildOptions = {}): Promise<void> => {
    const root = opts.root ?? process.cwd();
    const entry = opts.serverEntry ?? SERVER_ENTRY;

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
                    .then(() => reload(true))
                    .catch((err) => logError('rebuild failed', err));
            }, 120);
        });
    };

    let server: Bun.Subprocess | undefined;
    let onReady: (() => void) | undefined;
    let ready: Promise<void> = Promise.resolve();
    const startServer = (): void => {
        ready = new Promise<void>((resolve) => {
            onReady = resolve;
        });
        server = Bun.spawn(['bun', entry], {
            env: opts.host ? { ...process.env, HOST: opts.host } : undefined,
            ipc(message: DevMessage) {
                const dev = message.__hydris_dev__;
                if (dev?.watch !== undefined) startWatch(dev.watch);
                if (dev?.ready) onReady?.();
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
        await ready;
    };

    const reload = async (clear: boolean): Promise<void> => {
        if (clear) clearScreen();
        const result = await buildClient(opts);
        await restartServer();
        if (result === 'built') log('hydrate assets rebuilt');
        else if (result === 'empty') log('no views to build');
    };

    await reload(false);

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
