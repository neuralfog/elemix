import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'public', '_elemix');
const ASSET = /^\/_elemix\/([A-Za-z0-9_.-]+\.js)$/;

export const clientAsset = (pathname: string): Response | null => {
    const match = ASSET.exec(pathname);
    if (match === null) return null;
    return new Response(Bun.file(join(ASSETS, match[1])), {
        headers: { 'content-type': 'text/javascript; charset=utf-8' },
    });
};
