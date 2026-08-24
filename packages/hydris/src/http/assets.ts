import { join, resolve, sep } from 'node:path';
import { DEFAULT_ASSET_MAX_AGE } from '../render/client';
import { compressAsset } from './compression';
import type { Request } from './Request';

export type AssetConfig = {
    dir: string;
    maxAge?: number;
    immutable?: boolean;
};

const within = (target: string, dir: string): boolean =>
    target === dir || target.startsWith(dir + sep);

const cacheControl = (config: AssetConfig): string => {
    if (config.immutable) {
        return `public, max-age=${config.maxAge ?? DEFAULT_ASSET_MAX_AGE}, immutable`;
    }
    if (config.maxAge !== undefined) {
        return `public, max-age=${config.maxAge}`;
    }
    return 'no-cache';
};

const notFound = (): Response => new Response('Not Found', { status: 404 });

export const assetHandler = (
    config: AssetConfig,
): ((req: Request) => Promise<Response>) => {
    const dir = resolve(config.dir);
    const cache = cacheControl(config);
    return async (req: Request): Promise<Response> => {
        const rel = req.param('*');
        if (!rel) return notFound();
        const target = resolve(join(dir, rel));
        if (!within(target, dir)) return notFound();
        const file = Bun.file(target);
        if (!(await file.exists())) return notFound();
        const etag = `W/"${Math.floor(file.lastModified)}-${file.size}"`;
        if (req.headers.get('if-none-match') === etag) {
            return new Response(null, {
                status: 304,
                headers: {
                    etag,
                    'cache-control': cache,
                    vary: 'Accept-Encoding',
                },
            });
        }
        return compressAsset(target, { 'cache-control': cache, etag }, req);
    };
};
