import { join, resolve, sep } from 'node:path';
import { DEFAULT_ASSET_MAX_AGE } from '../render/client';
import type { Context } from './Context';

export interface AssetConfig {
    dir: string;
    maxAge?: number;
    immutable?: boolean;
}

const within = (target: string, dir: string): boolean =>
    target === dir || target.startsWith(dir + sep);

export const isVersioned = (url: string): boolean => /[?&]v=/.test(url);

const cacheControl = (config: AssetConfig): string | null => {
    if (config.maxAge === undefined) return null;
    const value = `public, max-age=${config.maxAge}`;
    return config.immutable ? `${value}, immutable` : value;
};

const notFound = (): Response => new Response('Not Found', { status: 404 });

export const assetHandler = (
    config: AssetConfig,
): ((ctx: Context) => Promise<Response>) => {
    const dir = resolve(config.dir);
    const bare = cacheControl(config);
    const busted = `public, max-age=${config.maxAge ?? DEFAULT_ASSET_MAX_AGE}, immutable`;
    return async (ctx: Context): Promise<Response> => {
        const rel = ctx.param('*');
        if (!rel) return notFound();
        const target = resolve(join(dir, rel));
        if (!within(target, dir)) return notFound();
        const file = Bun.file(target);
        if (!(await file.exists())) return notFound();
        const cache = isVersioned(ctx.req.url) ? busted : bare;
        return new Response(
            file,
            cache ? { headers: { 'cache-control': cache } } : undefined,
        );
    };
};
