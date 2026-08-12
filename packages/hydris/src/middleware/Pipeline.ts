import type { DiContainer } from '../container/DiContainer';
import type { Context } from '../http/Context';
import { toResponse } from '../http/Reply';
import { BaseMiddleware, type Middleware } from './Middleware';

export type ErrorSink = (error: unknown) => Promise<Response>;

export class Pipeline {
    static run(
        ctx: Context,
        scope: DiContainer,
        middlewares: Middleware[],
        core: () => Promise<Response>,
        onError: ErrorSink,
    ): Promise<Response> {
        const step = async (index: number): Promise<Response> => {
            try {
                if (index === middlewares.length) return await core();
                const entry = middlewares[index];
                const middleware =
                    entry instanceof BaseMiddleware ? entry : scope.get(entry);
                return toResponse(
                    await middleware.handle(ctx, () => step(index + 1)),
                );
            } catch (error) {
                return onError(error);
            }
        };
        return step(0);
    }
}
