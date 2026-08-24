import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { Request } from './Request';

export type CompressionOptions = {
    threshold?: number;
    brotli?: boolean;
    gzip?: boolean;
};

type CompressionConfig = {
    threshold: number;
    brotli: boolean;
    gzip: boolean;
};

type Encoding = 'br' | 'gzip';

const DEFAULT_THRESHOLD = 1024;
const BROTLI_STATIC_QUALITY = 11;
const GZIP_STATIC_LEVEL = 9;
const BROTLI_DYNAMIC_QUALITY = 5;
const GZIP_DYNAMIC_LEVEL = 6;

const SIBLING: Record<Encoding, string> = { br: '.br', gzip: '.gz' };

let config: CompressionConfig | null = null;
let locked = false;

export const setCompression = (options: CompressionOptions = {}): void => {
    if (locked) {
        throw new Error(
            'App.compression() must be called before App.serve(); compression is locked once the server boots.',
        );
    }
    config = {
        threshold: options.threshold ?? DEFAULT_THRESHOLD,
        brotli: options.brotli ?? true,
        gzip: options.gzip ?? true,
    };
};

export const lockCompression = (): void => {
    locked = true;
};

export const resetCompression = (): void => {
    config = null;
    locked = false;
};

export const getCompression = (): CompressionConfig | null => config;

const COMPRESSIBLE = new Set([
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'application/manifest+json',
    'application/ld+json',
    'application/wasm',
    'application/x-javascript',
    'image/svg+xml',
    'image/x-icon',
    'font/ttf',
    'font/otf',
]);

const isCompressible = (contentType: string | null | undefined): boolean => {
    if (!contentType) return false;
    const type = contentType.split(';', 1)[0].trim().toLowerCase();
    if (type.startsWith('text/')) return true;
    if (type.endsWith('+json') || type.endsWith('+xml')) return true;
    return COMPRESSIBLE.has(type);
};

const parseAccept = (header: string | null): Map<string, number> => {
    const out = new Map<string, number>();
    if (!header) return out;
    for (const part of header.split(',')) {
        const segments = part.trim().split(';');
        const token = segments[0].trim().toLowerCase();
        if (token === '') continue;
        let q = 1;
        for (let i = 1; i < segments.length; i++) {
            const match = segments[i].trim().match(/^q=([0-9.]+)$/);
            if (match) q = Number.parseFloat(match[1]);
        }
        out.set(token, q);
    }
    return out;
};

const negotiate = (
    header: string | null,
    cfg: CompressionConfig,
): Encoding | null => {
    const accept = parseAccept(header);
    if (accept.size === 0) return null;
    const star = accept.get('*');
    const quality = (name: Encoding): number => {
        const direct = accept.get(name);
        return direct ?? star ?? 0;
    };
    const candidates: [Encoding, number][] = [];
    if (cfg.brotli) {
        const q = quality('br');
        if (q > 0) candidates.push(['br', q]);
    }
    if (cfg.gzip) {
        const q = quality('gzip');
        if (q > 0) candidates.push(['gzip', q]);
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b[1] - a[1] || (a[0] === 'br' ? -1 : 1));
    return candidates[0][0];
};

const compress = (
    bytes: Uint8Array,
    encoding: Encoding,
    brotliQuality: number,
    gzipLevel: number,
): Uint8Array => {
    if (encoding === 'br') {
        return brotliCompressSync(bytes, {
            params: {
                [constants.BROTLI_PARAM_QUALITY]: brotliQuality,
                [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
            },
        });
    }
    return gzipSync(bytes, { level: gzipLevel });
};

const addVary = (headers: Headers): void => {
    const existing = headers.get('vary');
    if (existing === null) {
        headers.set('vary', 'Accept-Encoding');
        return;
    }
    if (/(^|,\s*)accept-encoding(\s*,|$)/i.test(existing)) return;
    headers.set('vary', `${existing}, Accept-Encoding`);
};

const assetCache = new Map<string, Uint8Array>();

const asBody = (bytes: Uint8Array): BodyInit => bytes as unknown as BodyInit;

const readBytes = async (file: Bun.BunFile): Promise<Uint8Array> =>
    new Uint8Array(await file.arrayBuffer());

const siblingBytes = async (
    absPath: string,
    encoding: Encoding,
    sourceModified: number,
): Promise<Uint8Array | null> => {
    const sibling = Bun.file(absPath + SIBLING[encoding]);
    if ((await sibling.exists()) && sibling.lastModified >= sourceModified) {
        return readBytes(sibling);
    }
    return null;
};

const writeSibling = async (
    absPath: string,
    encoding: Encoding,
    bytes: Uint8Array,
): Promise<void> => {
    try {
        await Bun.write(absPath + SIBLING[encoding], bytes);
    } catch {}
};

const cacheKey = (absPath: string, mtime: number, encoding: Encoding): string =>
    `${absPath}\0${mtime}\0${encoding}`;

const encodedBytes = async (
    absPath: string,
    encoding: Encoding,
    lastModified: number,
    readSource: () => Promise<Uint8Array>,
    writeToDisk: boolean,
): Promise<Uint8Array> => {
    const key = cacheKey(absPath, Math.floor(lastModified), encoding);
    const cached = assetCache.get(key);
    if (cached) return cached;
    const disk = await siblingBytes(absPath, encoding, lastModified);
    let bytes: Uint8Array;
    if (disk) {
        bytes = disk;
    } else {
        bytes = compress(
            await readSource(),
            encoding,
            BROTLI_STATIC_QUALITY,
            GZIP_STATIC_LEVEL,
        );
        if (writeToDisk) await writeSibling(absPath, encoding, bytes);
    }
    assetCache.set(key, bytes);
    return bytes;
};

const bytesResponse = (
    bytes: Uint8Array,
    encoding: Encoding,
    contentType: string,
    headers: Record<string, string>,
): Response => {
    const out = new Headers(headers);
    out.set('content-type', contentType);
    out.set('content-encoding', encoding);
    out.set('content-length', String(bytes.length));
    addVary(out);
    return new Response(asBody(bytes), { headers: out });
};

export const compressAsset = async (
    absPath: string,
    headers: Record<string, string>,
    req: Request,
): Promise<Response> => {
    const cfg = config;
    const file = Bun.file(absPath);
    if (cfg === null) return new Response(file, { headers });
    if (!(await file.exists())) return new Response(file, { headers });

    const contentType = headers['content-type'] ?? file.type;
    const encoding = negotiate(req.headers.get('accept-encoding'), cfg);
    const identity = (): Response => {
        const out = new Headers(headers);
        addVary(out);
        return new Response(file, { headers: out });
    };
    if (
        encoding === null ||
        !isCompressible(contentType) ||
        file.size < cfg.threshold
    ) {
        return identity();
    }

    const bytes = await encodedBytes(
        absPath,
        encoding,
        file.lastModified,
        () => readBytes(file),
        false,
    );
    return bytesResponse(bytes, encoding, contentType, headers);
};

export type WarmResult = { raw: number; best: number };

export const warmAsset = async (
    absPath: string,
    contentTypeHint?: string,
    writeToDisk = false,
): Promise<WarmResult | null> => {
    const cfg = config;
    if (cfg === null) return null;
    const file = Bun.file(absPath);
    if (!(await file.exists())) return null;
    const contentType = contentTypeHint ?? file.type;
    if (!isCompressible(contentType) || file.size < cfg.threshold) return null;

    const encodings: Encoding[] = [];
    if (cfg.brotli) encodings.push('br');
    if (cfg.gzip) encodings.push('gzip');
    if (encodings.length === 0) return null;

    let source: Uint8Array | null = null;
    const readSource = async (): Promise<Uint8Array> => {
        if (source === null) source = await readBytes(file);
        return source;
    };
    let best = file.size;
    for (const encoding of encodings) {
        const bytes = await encodedBytes(
            absPath,
            encoding,
            file.lastModified,
            readSource,
            writeToDisk,
        );
        if (bytes.length < best) best = bytes.length;
    }
    return { raw: file.size, best };
};

const isCompressibleStatus = (status: number): boolean =>
    status >= 200 && status < 300 && status !== 204;

const rebuild = (res: Response, body: Uint8Array): Response =>
    new Response(asBody(body), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
    });

export const compressDynamic = async (
    res: Response,
    req: Request,
): Promise<Response> => {
    const cfg = config;
    if (cfg === null) return res;
    if (req.method === 'HEAD') return res;
    if (res.headers.has('content-encoding')) return res;
    if (!isCompressibleStatus(res.status)) return res;
    if (!isCompressible(res.headers.get('content-type'))) return res;

    const encoding = negotiate(req.headers.get('accept-encoding'), cfg);
    if (encoding === null) {
        addVary(res.headers);
        return res;
    }

    const body = new Uint8Array(await res.arrayBuffer());
    if (body.length < cfg.threshold) {
        res.headers.set('content-length', String(body.length));
        addVary(res.headers);
        return rebuild(res, body);
    }

    const compressed = compress(
        body,
        encoding,
        BROTLI_DYNAMIC_QUALITY,
        GZIP_DYNAMIC_LEVEL,
    );
    res.headers.set('content-encoding', encoding);
    res.headers.set('content-length', String(compressed.length));
    addVary(res.headers);
    return rebuild(res, compressed);
};
