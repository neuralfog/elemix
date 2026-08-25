import { Header } from '../constants';
import { type HandlerResult, Reply } from '../http/Reply';
import type { Request } from '../http/Request';
import type { ErrorHandlerClass } from './ErrorHandler';
import { HttpException } from './HttpException';

export type ErrorReporter = (
    error: unknown,
    req: Request,
) => void | Promise<void>;

export type ErrorRendererFn = (
    error: unknown,
    req: Request,
) => HandlerResult | Promise<HandlerResult>;

export type ErrorRenderer = ErrorRendererFn | ErrorHandlerClass;

export class DefaultErrorRenderer {
    private static readonly ESCAPE: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };

    static status(error: unknown): number {
        return error instanceof HttpException ? error.status : 500;
    }

    private static message(error: unknown): string {
        return error instanceof HttpException
            ? error.message
            : 'Internal Server Error';
    }

    private static escapeHtml(value: string): string {
        return value.replace(
            /[&<>"']/g,
            (char) => DefaultErrorRenderer.ESCAPE[char],
        );
    }

    private static wantsJson(req: Request): boolean {
        return (req.headers?.get(Header.Accept) ?? '').includes(
            'application/json',
        );
    }

    private static page(status: number, message: string): string {
        return (
            `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
            `<meta name="viewport" content="width=device-width,initial-scale=1">` +
            `<title>${status}</title></head>` +
            `<body style="font-family:system-ui,sans-serif;display:grid;` +
            `place-items:center;min-height:100vh;margin:0;color:#111">` +
            `<main style="text-align:center"><h1 style="font-size:4rem;margin:0">` +
            `${status}</h1><p style="opacity:.7">${DefaultErrorRenderer.escapeHtml(message)}</p></main>` +
            `</body></html>`
        );
    }

    static render(error: unknown, req: Request): HandlerResult {
        const status = DefaultErrorRenderer.status(error);
        const message = DefaultErrorRenderer.message(error);
        if (DefaultErrorRenderer.wantsJson(req)) {
            return Reply.json({ error: message, status }).status(status);
        }
        return Reply.html(DefaultErrorRenderer.page(status, message)).status(
            status,
        );
    }
}
