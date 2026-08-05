import { basename } from 'node:path';
import type { Component } from '@neuralfog/elemix';
import { $__runStores } from '@neuralfog/elemix/ssr-runtime';
import {
    getDefaultDocument,
    renderView,
    type ViewClass,
} from '../render/render';

type ViewData<V> = V extends new () => Component<unknown, infer D> ? D : never;

const viewDataScript = (data: unknown): string =>
    data === undefined
        ? ''
        : `<script>window.__elemix_vd=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const clientScript = (name: string | undefined): string =>
    name === undefined
        ? ''
        : `<script type="module" src="/_elemix/${name}.js"></script>`;

const bundleName = (View: unknown): string | undefined => {
    const bundle = (View as { $$__module?: string }).$$__module;
    return bundle === undefined
        ? undefined
        : basename(bundle).replace(/\.[tj]s$/, '');
};

const OUTLET = '<slot></slot>';

interface Pending {
    View: ViewClass;
    data: unknown;
    name: string | undefined;
}

export type HandlerResult = Reply | Response;

export class Reply {
    private documentOverride?: ViewClass;

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

    static view<V extends ViewClass | (() => unknown)>(
        View: V,
        data?: ViewData<V>,
    ): Reply {
        const name = bundleName(View);
        const proto = (View as { prototype?: Record<string, unknown> })
            .prototype;

        if (proto === undefined || !('$$__ssr' in proto)) {
            const html = $__runStores(() => String((View as () => unknown)()));
            const script =
                name === undefined
                    ? ''
                    : `<script type="module">import { render } from "/_elemix/${name}.js"; for (const el of document.querySelectorAll("[data-elemix-view]")) el.replaceChildren(render());</script>`;
            return Reply.html(`<div data-elemix-view>${html}</div>${script}`);
        }

        return new Reply(
            null,
            200,
            { 'content-type': 'text/html; charset=utf-8' },
            { View: View as ViewClass, data, name },
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

    document(document: ViewClass): this {
        this.documentOverride = document;
        return this;
    }

    toResponse(): Response {
        const body = this.pending ? this.renderPending() : this.body;
        return new Response(body, {
            status: this.code,
            headers: this.headers,
        });
    }

    private renderPending(): string {
        const { View, data, name } = this.pending as Pending;
        const page = viewDataScript(data) + renderView(View, data);
        const document =
            this.documentOverride ??
            (View as { $$__document?: ViewClass }).$$__document ??
            getDefaultDocument();
        if (document === undefined) return page + clientScript(name);
        const frame = renderView(document, data);
        const inner =
            page + clientScript(bundleName(document)) + clientScript(name);
        if (frame.includes(OUTLET)) return frame.replace(OUTLET, inner);
        if (frame.includes('</body>')) {
            return frame.replace('</body>', `${inner}</body>`);
        }
        return frame + inner;
    }
}

export const toResponse = (result: HandlerResult): Response =>
    result instanceof Reply ? result.toResponse() : result;
