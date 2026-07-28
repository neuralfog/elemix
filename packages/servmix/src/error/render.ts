import type { Context } from '../http/Context';
import { type HandlerResult, Reply } from '../http/Reply';
import type { ErrorHandlerClass } from './ErrorHandler';
import { HttpException } from './HttpException';

export type ErrorReporter = (
    error: unknown,
    ctx: Context,
) => void | Promise<void>;

export type ErrorRendererFn = (
    error: unknown,
    ctx: Context,
) => HandlerResult | Promise<HandlerResult>;

export type ErrorRenderer = ErrorRendererFn | ErrorHandlerClass;

export const statusOf = (error: unknown): number =>
    error instanceof HttpException ? error.status : 500;

const messageOf = (error: unknown): string =>
    error instanceof HttpException ? error.message : 'Internal Server Error';

const ESCAPE: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (char) => ESCAPE[char]);

const wantsJson = (ctx: Context): boolean =>
    (ctx.req.headers?.get('accept') ?? '').includes('application/json');

const page = (status: number, message: string): string =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${status}</title></head>` +
    `<body style="font-family:system-ui,sans-serif;display:grid;` +
    `place-items:center;min-height:100vh;margin:0;color:#111">` +
    `<main style="text-align:center"><h1 style="font-size:4rem;margin:0">` +
    `${status}</h1><p style="opacity:.7">${escapeHtml(message)}</p></main>` +
    `</body></html>`;

export const defaultErrorRenderer: ErrorRendererFn = (error, ctx) => {
    const status = statusOf(error);
    const message = messageOf(error);
    if (wantsJson(ctx)) {
        return Reply.json({ error: message, status }).status(status);
    }
    return Reply.html(page(status, message)).status(status);
};
