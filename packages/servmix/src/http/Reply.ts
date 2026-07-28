import { renderView, type ViewClass } from '../render/render';

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

    static view(View: ViewClass): Reply {
        return Reply.html(renderView(View));
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
