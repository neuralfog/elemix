export interface CookieOptions {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export const parseCookies = (header: string | null): Map<string, string> => {
    const jar = new Map<string, string>();
    if (!header) return jar;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const name = part.slice(0, eq).trim();
        if (name === '') continue;
        jar.set(name, decodeURIComponent(part.slice(eq + 1).trim()));
    }
    return jar;
};

export const serializeCookie = (
    name: string,
    value: string,
    options: CookieOptions = {},
): string => {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
    }
    if (options.expires !== undefined) {
        parts.push(`Expires=${options.expires.toUTCString()}`);
    }
    parts.push(`Path=${options.path ?? '/'}`);
    if (options.domain !== undefined) parts.push(`Domain=${options.domain}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite !== undefined) {
        parts.push(`SameSite=${options.sameSite}`);
    }
    return parts.join('; ');
};
