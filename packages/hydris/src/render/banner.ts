import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';

const VERSION = ((): string => {
    try {
        const require = createRequire(import.meta.url);
        const pkg = require('@neuralfog/hydris/package.json') as {
            version?: string;
        };
        if (pkg.version) return pkg.version;
    } catch {}
    try {
        const pkg = readFileSync(
            new URL('../../package.json', import.meta.url),
            'utf8',
        );
        return (JSON.parse(pkg) as { version?: string }).version ?? '';
    } catch {}
    return '';
})();

const noColor = !process.stdout.isTTY || process.env.NO_COLOR !== undefined;

const paint = (code: string, s: string): string =>
    noColor ? s : `\x1b[${code}m${s}\x1b[0m`;

const violet = (s: string): string => paint('38;2;167;139;250', s);
const cyan = (s: string): string => paint('38;2;34;211;238', s);
const dim = (s: string): string => paint('38;2;110;118;129', s);
const bold = (s: string): string => paint('1', s);

const BAR = violet('▐▌');
const ARROW = violet('➜');

export const brandDim = (message: string): string =>
    `  ${BAR}  ${dim(message)}`;

const exposed = (host: string): boolean =>
    host === '0.0.0.0' || host === '::' || host === '';

const networkUrls = (protocol: string, port: number): string[] => {
    const out: string[] = [];
    for (const iface of Object.values(networkInterfaces())) {
        for (const net of iface ?? []) {
            if (net.family === 'IPv4' && !net.internal) {
                out.push(`${protocol}//${net.address}:${port}/`);
            }
        }
    }
    return out;
};

export type BannerInfo = {
    host: string;
    port: number;
    protocol: string;
    dev: boolean;
    ms: number;
};

export const serveBanner = (info: BannerInfo): string => {
    const { host, port, protocol, dev, ms } = info;
    const local = `${protocol}//${exposed(host) ? 'localhost' : host}:${port}/`;
    const mode = dev ? cyan('development') : violet('production');

    const lines = [
        '',
        `  ${BAR}  ${bold('elemix')} ${dim('·')} ${dim('hydris')}`,
        `  ${BAR}  ${dim(`v${VERSION}`)}  ${dim('ready in')} ${bold(String(ms))} ${dim('ms')}  ${dim('·')}  ${mode}`,
        '',
        `  ${ARROW}  ${dim('Local:')}    ${cyan(local)}`,
    ];

    if (exposed(host)) {
        const nets = networkUrls(protocol, port);
        if (nets.length === 0) {
            lines.push(
                `  ${ARROW}  ${dim('Network:')}  ${dim('(no external interface)')}`,
            );
        } else {
            for (const url of nets) {
                lines.push(`  ${ARROW}  ${dim('Network:')}  ${cyan(url)}`);
            }
        }
    } else {
        lines.push(
            `  ${ARROW}  ${dim('Network:')}  ${dim('use --host to expose')}`,
        );
    }
    lines.push('');
    return lines.join('\n');
};
