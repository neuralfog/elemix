import { join, resolve, sep } from 'node:path';
import { Header, HeaderValue } from '../constants';
import { DEFAULT_ASSET_MAX_AGE } from '../render/client';
import { compressAsset } from './compression';
import type { Request } from './Request';

export type AssetConfig = {
    dir: string;
    maxAge?: number;
    immutable?: boolean;
};

export class AssetHandler {
    private static within(target: string, dir: string): boolean {
        return target === dir || target.startsWith(dir + sep);
    }

    private static cacheControl(config: AssetConfig): string {
        if (config.immutable) {
            return `public, max-age=${config.maxAge ?? DEFAULT_ASSET_MAX_AGE}, immutable`;
        }
        if (config.maxAge !== undefined) {
            return `public, max-age=${config.maxAge}`;
        }
        return HeaderValue.NoCache;
    }

    private static notFound(): Response {
        return new Response('Not Found', { status: 404 });
    }

    static create(config: AssetConfig): (req: Request) => Promise<Response> {
        const dir = resolve(config.dir);
        const cache = AssetHandler.cacheControl(config);
        return async (req: Request): Promise<Response> => {
            const rel = req.param('*');
            if (!rel) return AssetHandler.notFound();
            const target = resolve(join(dir, rel));
            if (!AssetHandler.within(target, dir)) {
                return AssetHandler.notFound();
            }
            const file = Bun.file(target);
            if (!(await file.exists())) return AssetHandler.notFound();
            const etag = `W/"${Math.floor(file.lastModified)}-${file.size}"`;
            if (req.headers.get(Header.IfNoneMatch) === etag) {
                return new Response(null, {
                    status: 304,
                    headers: {
                        [Header.ETag]: etag,
                        [Header.CacheControl]: cache,
                        [Header.Vary]: Header.AcceptEncoding,
                    },
                });
            }
            return compressAsset(
                target,
                { [Header.CacheControl]: cache, [Header.ETag]: etag },
                req,
            );
        };
    }
}
