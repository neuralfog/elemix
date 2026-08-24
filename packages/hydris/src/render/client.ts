import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compressAsset, warmAsset } from '../http/compression';
import type { Request } from '../http/Request';

const ASSETS = join(process.cwd(), 'public', '_elemix');
const ASSET = /^\/_elemix\/([A-Za-z0-9_.-]+\.js)$/;
const HASHED = /-[a-z0-9]{8,}\.js$/;

export const DEFAULT_ASSET_MAX_AGE = 31_536_000;

let manifest: Record<string, string> | null | undefined;

const loadManifest = (): Record<string, string> | null => {
    if (manifest !== undefined) return manifest;
    try {
        manifest = JSON.parse(
            readFileSync(join(ASSETS, 'manifest.json'), 'utf8'),
        ) as Record<string, string>;
    } catch {
        manifest = null;
    }
    return manifest;
};

export const resolveClientBundle = (name: string): string =>
    loadManifest()?.[name] ?? `${name}.js`;

type Resolved = {
    absPath: string;
    headers: Record<string, string>;
};

const resolveClientAsset = (
    pathname: string,
    maxAge: number,
): Resolved | null => {
    const match = ASSET.exec(pathname);
    if (match === null) return null;
    const file = match[1];
    const cacheControl = HASHED.test(file)
        ? `public, max-age=${maxAge}, immutable`
        : 'no-cache';
    return {
        absPath: join(ASSETS, file),
        headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': cacheControl,
        },
    };
};

export const clientAsset = (
    pathname: string,
    maxAge: number = DEFAULT_ASSET_MAX_AGE,
): Response | null => {
    const resolved = resolveClientAsset(pathname, maxAge);
    if (resolved === null) return null;
    return new Response(Bun.file(resolved.absPath), {
        headers: resolved.headers,
    });
};

export const clientAssetResponse = (
    pathname: string,
    req: Request,
    maxAge: number = DEFAULT_ASSET_MAX_AGE,
): Promise<Response> | null => {
    const resolved = resolveClientAsset(pathname, maxAge);
    if (resolved === null) return null;
    return compressAsset(resolved.absPath, resolved.headers, req);
};

const CLIENT_CONTENT_TYPE = 'text/javascript; charset=utf-8';

export type PrecompressStats = { count: number; raw: number; best: number };

export const precompressClientAssets = async (): Promise<PrecompressStats> => {
    const stats: PrecompressStats = { count: 0, raw: 0, best: 0 };
    let entries: string[];
    try {
        entries = readdirSync(ASSETS);
    } catch {
        return stats;
    }
    for (const name of entries) {
        if (!name.endsWith('.js')) continue;
        const result = await warmAsset(
            join(ASSETS, name),
            CLIENT_CONTENT_TYPE,
            true,
        );
        if (result === null) continue;
        stats.count += 1;
        stats.raw += result.raw;
        stats.best += result.best;
    }
    return stats;
};
