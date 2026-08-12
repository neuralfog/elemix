import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'public', '_elemix');
const ASSET = /^\/_elemix\/([A-Za-z0-9_.-]+\.js)$/;
const HASHED = /-[a-z0-9]{8,}\.js$/;

export const DEFAULT_ASSET_MAX_AGE = 31_536_000;

export const clientAsset = (
    pathname: string,
    maxAge: number = DEFAULT_ASSET_MAX_AGE,
    versioned = false,
): Response | null => {
    const match = ASSET.exec(pathname);
    if (match === null) return null;
    const file = match[1];
    const cacheControl =
        versioned || HASHED.test(file)
            ? `public, max-age=${maxAge}, immutable`
            : 'no-cache';
    return new Response(Bun.file(join(ASSETS, file)), {
        headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': cacheControl,
        },
    });
};
