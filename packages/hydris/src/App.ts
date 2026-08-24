import type { DiContainer } from './container/DiContainer';
import type { ServiceProviderClass } from './container/ServiceProvider';
import type { ErrorRenderer, ErrorReporter } from './error/render';
import { type AssetConfig, assetHandler } from './http/assets';
import {
    type CompressionOptions,
    getCompression,
    lockCompression,
    setCompression,
} from './http/compression';
import { Request } from './http/Request';
import type { Middleware } from './middleware/Middleware';
import { clientAssetResponse, precompressClientAssets } from './render/client';
import {
    type DevOptions,
    enableDevMode,
    isDevMode,
    isLiveReload,
    LIVERELOAD_PATH,
    liveReloadResponse,
} from './render/dev';
import {
    lockDefaultDocument,
    setDefaultDocument,
    type ViewClass,
} from './render/render';
import { brandDim, serveBanner } from './render/banner';
import { setResetStyles } from './render/reset';
import { container, router } from './routing/Route';
import { segmentsOf } from './routing/RouteDefinition';
import {
    handleUnhandled,
    setUnhandledHandler,
    type UnhandledHandler,
} from './unhandled';

export type ServeOptions = {
    port?: number;
    hostname?: string;
    unix?: string;
    development?: boolean;
    reusePort?: boolean;
    idleTimeout?: number;
    maxRequestBodySize?: number;
    tls?: Bun.TLSOptions | Bun.TLSOptions[];
    trustProxy?: boolean;
    elemixAssets?: { maxAge?: number };
};

const registerRuntimeRoutes = (maxAge?: number): void => {
    router.registerStatic('/_elemix/*', (req: Request) => {
        const bundle = clientAssetResponse(
            `/_elemix/${req.param('*')}`,
            req,
            maxAge,
        );
        return bundle ?? new Response('Not Found', { status: 404 });
    });
    if (isLiveReload()) {
        router.registerStatic(LIVERELOAD_PATH, () => liveReloadResponse());
    }
};

const logStartup = (server: Bun.Server, options: ServeOptions): void => {
    console.log(
        serveBanner({
            host: server.hostname ?? 'localhost',
            port: server.port ?? 0,
            protocol: server.url.protocol,
            dev: options.development ?? process.env.NODE_ENV !== 'production',
            ms: Math.round(performance.now()),
        }),
    );
    if (isLiveReload()) console.log(brandDim('live reload enabled'));
    if (isDevMode()) process.send?.({ __hydris_dev__: { ready: true } });

    if (getCompression() !== null) {
        void precompressClientAssets().then((stats) => {
            if (stats.count === 0) return;
            const kb = (bytes: number): string =>
                `${(bytes / 1024).toFixed(1)}KB`;
            console.log(
                brandDim(
                    `precompressed ${stats.count} bundles ${kb(stats.raw)} -> ${kb(stats.best)}`,
                ),
            );
        });
    }
};

const installProcessHandlers = (server: Bun.Server): void => {
    let closing = false;
    const shutdown = async (signal: string): Promise<void> => {
        if (closing) return;
        closing = true;
        console.log(brandDim(`${signal} - draining connections`));
        await server.stop();
        await container.dispose();
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        handleUnhandled(reason);
    });
    process.on('uncaughtException', (error) => {
        handleUnhandled(error);
    });
};

export class App {
    static get container(): DiContainer {
        return container;
    }

    static onUnhandled(handler: UnhandledHandler): void {
        setUnhandledHandler(handler);
    }

    static providers(providers: ServiceProviderClass[]): void {
        const instances = providers.map((Provider) => new Provider());
        for (const provider of instances) provider.register(container);
        container.start();
        for (const provider of instances) provider.boot?.(container);
    }

    static middlewares(middlewares: Middleware[]): void {
        router.use(middlewares);
    }

    static assets(prefix: string, config: AssetConfig): void {
        const base = `/${segmentsOf(prefix).join('/')}`;
        router.registerStatic(`${base}/*`, assetHandler(config));
    }

    static compression(options: CompressionOptions = {}): void {
        setCompression(options);
    }

    static devMode(options?: DevOptions): void {
        enableDevMode(options);
    }

    static document(document: ViewClass): void {
        setDefaultDocument(document);
    }

    static resetStyles(css: string): void {
        setResetStyles(css);
    }

    static onError(reporter: ErrorReporter): void {
        router.onError(reporter);
    }

    static renderError(renderer: ErrorRenderer): void;
    static renderError(name: string, renderer: ErrorRenderer): void;
    static renderError(
        nameOrRenderer: string | ErrorRenderer,
        renderer?: ErrorRenderer,
    ): void {
        if (typeof nameOrRenderer === 'string') {
            router.renderErrorForName(
                nameOrRenderer,
                renderer as ErrorRenderer,
            );
        } else {
            router.renderError(nameOrRenderer);
        }
    }

    static serve(options: ServeOptions = {}): void {
        lockDefaultDocument();
        lockCompression();
        const { trustProxy = false, elemixAssets, ...serveOptions } = options;

        registerRuntimeRoutes(elemixAssets?.maxAge);

        const server = Bun.serve({
            port: 3000,
            hostname: 'localhost',
            ...serveOptions,
            fetch: (req: globalThis.Request, srv: Bun.Server) =>
                router.dispatch(
                    new Request(req),
                    srv.requestIP(req)?.address ?? '',
                    trustProxy,
                ),
        } as Parameters<typeof Bun.serve>[0]);

        logStartup(server, options);
        installProcessHandlers(server);
    }
}
