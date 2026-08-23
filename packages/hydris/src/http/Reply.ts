import { basename } from 'node:path';
import type { Component } from '@neuralfog/elemix';
import { devReloadScript } from '../render/dev';
import {
    applyResetToSsr,
    resetConfigScript,
    resetDocumentStyle,
} from '../render/reset';
import {
    getDefaultDocument,
    renderView,
    type ViewClass,
} from '../render/render';
import { getAssetVersion } from '../render/version';
import { type CookieOptions, serializeCookie } from './Cookie';

type ViewData<V> = V extends new () => Component<unknown, infer D> ? D : never;

const viewDataScript = (data: unknown): string =>
    data === undefined
        ? ''
        : `<script>window.__elemix_vd=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const assetQuery = (): string => {
    const version = getAssetVersion();
    return version === undefined ? '' : `?v=${version}`;
};

const clientScript = (name: string | undefined): string =>
    name === undefined
        ? ''
        : `<script type="module" defer src="/_elemix/${name}.js${assetQuery()}"></script>`;

const bundleName = (View: unknown): string | undefined => {
    const bundle = (View as { $$__module?: string }).$$__module;
    return bundle === undefined
        ? undefined
        : basename(bundle).replace(/\.[tj]s$/, '');
};

const OUTLET = '<slot></slot>';

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
        });
    }

    static view<V extends ViewClass>(View: V, data?: ViewData<V>): Reply {
        return new Reply(
            null,
            200,
            { 'content-type': 'text/html; charset=utf-8' },
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

    toResponse(): Response {
        const body = this.pending ? this.renderPending() : this.body;
        const headers = new Headers(this.headers);
        for (const cookie of this.cookies) headers.append('Set-Cookie', cookie);
        return new Response(body, { status: this.code, headers });
    }

    private renderPending(): string {
        const SHIP_CLIENT = true;
        const { View, data, name } = this.pending as Pending;
        const dev = devReloadScript();
        const resetCfg = resetConfigScript() + resetDocumentStyle();
        const client = SHIP_CLIENT ? clientScript(name) : '';
        const page = viewDataScript(data) + renderView(View, data);
        const document =
            this.documentOverride ??
            (View as { $$__document?: ViewClass }).$$__document ??
            getDefaultDocument();
        if (document === undefined) {
            return applyResetToSsr(resetCfg + page + dev + client);
        }
        const frame = renderView(document, data);
        const inner = resetCfg + page + dev;
        let html: string;
        if (frame.includes(OUTLET)) {
            html = frame.replace(OUTLET, inner);
        } else if (frame.includes('</body>')) {
            html = frame.replace('</body>', `${inner}</body>`);
        } else {
            html = frame + inner;
        }
        if (client) {
            html = html.includes('</body>')
                ? html.replace('</body>', `${client}</body>`)
                : html + client;
        }
        return applyResetToSsr(html);
    }
}

export const toResponse = (result: HandlerResult): Response =>
    result instanceof Reply ? result.toResponse() : result;
