import { basename } from 'node:path';
import type { Component } from '@neuralfog/elemix';
import { $__setStores } from '@neuralfog/elemix/ssr-runtime';
import { devReloadScript } from '../render/dev';
import {
    applyResetToSsr,
    resetConfigScript,
    resetDocumentStyle,
} from '../render/reset';
import { resolveClientBundle } from '../render/client';
import {
    getDefaultDocument,
    renderView,
    type ViewClass,
} from '../render/render';
import { type CookieOptions, parseCookies, serializeCookie } from './Cookie';

type ViewData<V> = V extends new () => Component<unknown, infer D> ? D : never;

const viewDataScript = (data: unknown): string =>
    data === undefined
        ? ''
        : `<script type="application/json" id="__elemix_vd">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

type HeaderSource = { headers: Headers };

const STORE_PREFIX = 'store.';

const parseStores = (req?: HeaderSource): Record<string, unknown> => {
    const jar = parseCookies(req?.headers.get('cookie') ?? null);
    const seed: Record<string, unknown> = {};
    for (const [name, value] of jar) {
        if (!name.startsWith(STORE_PREFIX)) continue;
        try {
            const parsed = JSON.parse(value);
            if (
                parsed !== null &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed)
            ) {
                seed[name.slice(STORE_PREFIX.length)] = parsed;
            }
        } catch {}
    }
    return seed;
};

const storesScript = (seed: Record<string, unknown>): string =>
    `<script type="application/json" id="__hydris_stores">${JSON.stringify(seed).replace(/</g, '\\u003c')}</script>`;

const clientScript = (name: string | undefined): string =>
    name === undefined
        ? ''
        : `<script type="module" defer src="/_elemix/${resolveClientBundle(name)}"></script>`;

const bundleName = (View: unknown): string | undefined => {
    const bundle = (View as { $$__module?: string }).$$__module;
    return bundle === undefined
        ? undefined
        : basename(bundle).replace(/\.[tj]s$/, '');
};

const OUTLET = '<slot></slot>';

const outletIndex = (html: string): number => {
    let depth = 0;
    let i = 0;
    while (i < html.length) {
        if (depth === 0 && html.startsWith(OUTLET, i)) return i;
        if (html.startsWith('<template', i)) {
            depth++;
            i += 9;
            continue;
        }
        if (html.startsWith('</template>', i)) {
            if (depth > 0) depth--;
            i += 11;
            continue;
        }
        i++;
    }
    return -1;
};

type Pending = {
    View: ViewClass;
    data: unknown;
    name: string | undefined;
};

export type HandlerResult = Reply | Response;

export class Reply {
    private documentOverride?: ViewClass;
    private readonly cookies: string[] = [];

    private constructor(
        private readonly body: BodyInit | null,
        private code: number,
        private readonly headers: Record<string, string>,
        private readonly pending?: Pending,
    ) {}

    static html(body: string): Reply {
        return new Reply(body, 200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache',
        });
    }

    static view<V extends ViewClass>(View: V, data?: ViewData<V>): Reply {
        return new Reply(
            null,
            200,
            {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'no-cache',
            },
            { View, data, name: bundleName(View) },
        );
    }

    static text(body: string): Reply {
        return new Reply(body, 200, {
            'content-type': 'text/plain; charset=utf-8',
        });
    }

    static json(data: unknown): Reply {
        return new Reply(JSON.stringify(data), 200, {
            'content-type': 'application/json; charset=utf-8',
        });
    }

    static redirect(location: string, code = 302): Reply {
        return new Reply(null, code, { location });
    }

    status(code: number): this {
        this.code = code;
        return this;
    }

    header(name: string, value: string): this {
        this.headers[name] = value;
        return this;
    }

    cookie(name: string, value: string, options?: CookieOptions): this {
        this.cookies.push(serializeCookie(name, value, options));
        return this;
    }

    clearCookie(name: string, options?: CookieOptions): this {
        this.cookies.push(serializeCookie(name, '', { ...options, maxAge: 0 }));
        return this;
    }

    document(document: ViewClass): this {
        this.documentOverride = document;
        return this;
    }

    toResponse(req?: HeaderSource): Response {
        const body = this.pending ? this.renderPending(req) : this.body;
        const headers = new Headers(this.headers);
        for (const cookie of this.cookies) headers.append('Set-Cookie', cookie);
        return new Response(body, { status: this.code, headers });
    }

    private renderPending(req?: HeaderSource): string {
        const SHIP_CLIENT = true;
        const { View, data, name } = this.pending as Pending;
        const seed = parseStores(req);
        $__setStores(seed);
        const dev = devReloadScript();
        const resetCfg = resetConfigScript() + resetDocumentStyle();
        const client = SHIP_CLIENT ? clientScript(name) : '';
        const page =
            viewDataScript(data) + storesScript(seed) + renderView(View, data);
        const document =
            this.documentOverride ??
            (View as { $$__document?: ViewClass }).$$__document ??
            getDefaultDocument();
        if (document === undefined) {
            return applyResetToSsr(resetCfg + page + dev + client);
        }
        const frame = renderView(document, data);
        const inner = resetCfg + page;
        let html: string;
        const outlet = outletIndex(frame);
        if (outlet >= 0) {
            html =
                frame.slice(0, outlet) +
                inner +
                frame.slice(outlet + OUTLET.length);
        } else if (frame.includes('</body>')) {
            html = frame.replace('</body>', `${inner}</body>`);
        } else {
            html = frame + inner;
        }
        if (dev) {
            html = html.includes('</head>')
                ? html.replace('</head>', `${dev}</head>`)
                : dev + html;
        }
        if (client) {
            html = html.includes('</body>')
                ? html.replace('</body>', `${client}</body>`)
                : html + client;
        }
        return applyResetToSsr(html);
    }
}

export const toResponse = (
    result: HandlerResult,
    req?: HeaderSource,
): Response => (result instanceof Reply ? result.toResponse(req) : result);
