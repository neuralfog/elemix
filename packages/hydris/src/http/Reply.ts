import { basename } from 'node:path';
import type { Component } from '@neuralfog/elemix';
import { $__runStores } from '@neuralfog/elemix/ssr-runtime';
import { renderView, type ViewClass } from '../render/render';

type ViewData<V> = V extends new () => Component<unknown, infer D> ? D : never;

const viewDataScript = (data: unknown): string =>
    data === undefined
        ? ''
        : `<script>window.__elemix_vd=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

export type HandlerResult = Reply | Response;

export class Reply {
    private constructor(
        private readonly body: BodyInit | null,
        private code: number,
        private readonly headers: Record<string, string>,
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
        const bundle = (View as { $$__module?: string }).$$__module;
        const name =
            bundle === undefined
                ? undefined
                : basename(bundle).replace(/\.[tj]s$/, '');
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

        const script =
            name === undefined
                ? ''
                : `<script type="module" src="/_elemix/${name}.js"></script>`;
        return Reply.html(
            viewDataScript(data) + renderView(View as ViewClass, data) + script,
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

    toResponse(): Response {
        return new Response(this.body, {
            status: this.code,
            headers: this.headers,
        });
    }
}

export const toResponse = (result: HandlerResult): Response =>
    result instanceof Reply ? result.toResponse() : result;
