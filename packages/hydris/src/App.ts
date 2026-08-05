import type { ServiceProviderClass } from './container/ServiceProvider';
import type { ErrorRenderer, ErrorReporter } from './error/render';
import type { Request } from './http/Request';
import type { Middleware } from './middleware/Middleware';
import { clientAsset } from './render/client';
import {
    lockDefaultDocument,
    setDefaultDocument,
    type ViewClass,
} from './render/render';
import { container, router } from './routing/Route';

export interface ServeOptions {
    port?: number;
    hostname?: string;
    unix?: string;
    development?: boolean;
    reusePort?: boolean;
    idleTimeout?: number;
    maxRequestBodySize?: number;
    tls?: Bun.TLSOptions | Bun.TLSOptions[];
}

export class App {
    static providers(providers: ServiceProviderClass[]): void {
        const instances = providers.map((Provider) => new Provider());
        for (const provider of instances) provider.register(container);
        container.start();
        for (const provider of instances) provider.boot?.(container);
    }

    static middlewares(middlewares: Middleware[]): void {
        router.use(middlewares);
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
        const server = Bun.serve({
            port: 3000,
            hostname: 'localhost',
            ...options,
            fetch: (req: globalThis.Request) => {
                const asset = clientAsset(new URL(req.url).pathname);
                return asset ?? router.dispatch(req as Request);
            },
        } as Parameters<typeof Bun.serve>[0]);
        console.log(
            `Server running at ${server.url.protocol}//${server.hostname}:${server.port}`,
        );
    }
}
