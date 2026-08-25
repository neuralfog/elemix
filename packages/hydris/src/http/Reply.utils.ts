import { basename } from 'node:path';
import { resolveClientBundle } from '../render/client';
import { jsonIsland } from '../render/island';
import { Header, HeaderValue, Mime } from '../constants';

export const htmlHeaders = (): Record<string, string> => ({
    [Header.ContentType]: Mime.Html,
    [Header.CacheControl]: HeaderValue.NoCache,
});

export const viewDataScript = (data: unknown): string =>
    data === undefined ? '' : jsonIsland('__elemix_vd', data);

export const storesScript = (seed: Record<string, unknown>): string =>
    jsonIsland('__hydris_stores', seed);

export const clientScript = (name: string | undefined): string =>
    name === undefined
        ? ''
        : `<script type="module" defer src="/_elemix/${resolveClientBundle(name)}"></script>`;

export const bundleName = (View: unknown): string | undefined => {
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

export const composeDocument = (
    frame: string,
    inner: string,
    dev: string,
    client: string,
): string => {
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
    return html;
};
