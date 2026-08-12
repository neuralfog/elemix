import { afterEach, describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';
import { asset, setAssetVersion } from '../src/render/version';
import { BarePage } from './fixtures/BarePage';

const render = (reply: Reply): Promise<string> => reply.toResponse().text();

describe('asset()', () => {
    afterEach(() => {
        setAssetVersion(undefined);
    });

    it('is a noop when no version is set', () => {
        expect(asset('/static/app.css')).toBe('/static/app.css');
    });

    it('appends ?v=<token> when a version is set', () => {
        setAssetVersion('abc123');
        expect(asset('/static/app.css')).toBe('/static/app.css?v=abc123');
    });

    it('uses & when the path already has a query', () => {
        setAssetVersion('abc123');
        expect(asset('/static/app.css?theme=dark')).toBe(
            '/static/app.css?theme=dark&v=abc123',
        );
    });
});

describe('elemix client script versioning', () => {
    afterEach(() => {
        setAssetVersion(undefined);
    });

    it('appends ?v= to the injected bundle script when versioned', async () => {
        setAssetVersion('v1');
        const html = await render(Reply.view(BarePage));
        expect(html).toContain('/_elemix/BarePage.js?v=v1');
    });

    it('emits a bare bundle url when no version is set', async () => {
        const html = await render(Reply.view(BarePage));
        expect(html).toContain('/_elemix/BarePage.js"');
        expect(html).not.toContain('?v=');
    });
});
