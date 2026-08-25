import { Header, HeaderValue, Mime } from '../constants';

export type DevOptions = {
    liveReload?: boolean;
    watch?: string;
};

type DevConfig = {
    liveReload: boolean;
    watch: string;
};

let config: DevConfig | undefined;

export const enableDevMode = (options: DevOptions = {}): void => {
    config = {
        liveReload: options.liveReload ?? true,
        watch: options.watch ?? 'src',
    };
    process.send?.({ __hydris_dev__: config });
};

export const isDevMode = (): boolean => config !== undefined;

export const isLiveReload = (): boolean => config?.liveReload === true;

export const LIVERELOAD_PATH = '/__hydris/livereload';

const encoder = new TextEncoder();

const CLIENT = `(()=>{let d=!1;const e=new EventSource(${JSON.stringify(
    LIVERELOAD_PATH,
)});e.onopen=()=>{d&&location.reload()};e.onerror=()=>{d=!0}})();`;

export const devReloadScript = (): string =>
    isLiveReload() ? `<script>${CLIENT}</script>` : '';

export const liveReloadResponse = (): Response => {
    let ping: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode('retry: 200\n\n'));
            ping = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch {
                    if (ping) clearInterval(ping);
                }
            }, 15000);
        },
        cancel() {
            if (ping) clearInterval(ping);
        },
    });
    return new Response(stream, {
        headers: {
            [Header.ContentType]: Mime.EventStream,
            [Header.CacheControl]: HeaderValue.NoCache,
            [Header.Connection]: HeaderValue.KeepAlive,
        },
    });
};
