import type { DiContainer } from './container/DiContainer';
import type { ServiceProviderClass } from './container/ServiceProvider';
import type { ErrorRenderer, ErrorReporter } from './error/render';
import { type AssetConfig, assetHandler, isVersioned } from './http/assets';
import { Request } from './http/Request';
import type { Middleware } from './middleware/Middleware';
import { clientAsset } from './render/client';
import {
    lockDefaultDocument,
    setDefaultDocument,
    type ViewClass,
} from './render/render';
import { lockAssetVersion, setAssetVersion } from './render/version';
import { container, router } from './routing/Route';
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
        const base = `/${prefix.split('/').filter(Boolean).join('/')}`;
        router.registerStatic(`${base}/*`, assetHandler(config));
    }

    static version(token: string): void {
        setAssetVersion(token);
    }

    static document(document: ViewClass): void {
        setDefaultDocument(document);
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
        lockAssetVersion();
        const { trustProxy = false, elemixAssets, ...serveOptions } = options;

        router.registerStatic('/_elemix/*', (req: Request) => {
            const bundle = clientAsset(
                `/_elemix/${req.param('*')}`,
                elemixAssets?.maxAge,
                isVersioned(req.url),
            );
            return bundle ?? new Response('Not Found', { status: 404 });
        });

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
        console.log(
            `Server running at ${server.url.protocol}//${server.hostname}:${server.port}`,
        );

        let closing = false;
        const shutdown = async (signal: string): Promise<void> => {
            if (closing) return;
            closing = true;
            console.log(`${signal} received, draining connections...`);
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
    }
}
