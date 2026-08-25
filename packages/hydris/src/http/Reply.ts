import type { Component } from '@neuralfog/elemix';
import { $__setStores } from '@neuralfog/elemix/ssr-runtime';
import { devReloadScript } from '../render/dev';
import {
    getDefaultDocument,
    renderView,
    type ViewClass,
} from '../render/render';
import {
    applyResetToSsr,
    resetConfigScript,
    resetDocumentStyle,
} from '../render/reset';
import { CookieAuthority, type CookieOptions } from './CookieAuthority';
import { Header, Mime } from '../constants';
import type { Request } from './Request';
import {
    bundleName,
    clientScript,
    composeDocument,
    htmlHeaders,
    storesScript,
    viewDataScript,
} from './Reply.utils';

type ViewData<V> = V extends new () => Component<unknown, infer D> ? D : never;

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
        return new Reply(body, 200, htmlHeaders());
    }

    static view<V extends ViewClass>(View: V, data?: ViewData<V>): Reply {
        return new Reply(null, 200, htmlHeaders(), {
            View,
            data,
            name: bundleName(View),
        });
    }

    static text(body: string): Reply {
        return new Reply(body, 200, {
            [Header.ContentType]: Mime.Text,
        });
    }

    static json(data: unknown): Reply {
        return new Reply(JSON.stringify(data), 200, {
            [Header.ContentType]: Mime.Json,
        });
    }

    static redirect(location: string, code = 302): Reply {
        return new Reply(null, code, { [Header.Location]: location });
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
        this.cookies.push(CookieAuthority.serialize(name, value, options));
        return this;
    }

    clearCookie(name: string, options?: CookieOptions): this {
        this.cookies.push(
            CookieAuthority.serialize(name, '', { ...options, maxAge: 0 }),
        );
        return this;
    }

    document(document: ViewClass): this {
        this.documentOverride = document;
        return this;
    }

    toResponse(req?: Request): Response {
        const body = this.pending ? this.renderPending(req) : this.body;
        const headers = new Headers(this.headers);
        for (const cookie of this.cookies) {
            headers.append(Header.SetCookie, cookie);
        }
        return new Response(body, { status: this.code, headers });
    }

    private renderPending(req?: Request): string {
        const { View, data, name } = this.pending as Pending;
        const seed = req ? new CookieAuthority(req).stores() : {};
        $__setStores(seed);
        const dev = devReloadScript();
        const resetCfg = resetConfigScript() + resetDocumentStyle();
        const client = clientScript(name);
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
        return applyResetToSsr(composeDocument(frame, inner, dev, client));
    }
}

export const toResponse = (result: HandlerResult, req?: Request): Response =>
    result instanceof Reply ? result.toResponse(req) : result;
