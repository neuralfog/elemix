import { describe, expect, it } from 'bun:test';
import { clientAsset, DEFAULT_ASSET_MAX_AGE } from '../src/render/client';

describe('clientAsset caching', () => {
    it('returns null for non-asset paths', () => {
        expect(clientAsset('/whatever')).toBeNull();
        expect(clientAsset('/_elemix/not-js.css')).toBeNull();
    });

    it('immutably caches content-hashed chunks', () => {
        const res = clientAsset('/_elemix/chunk-33m7cpfj.js');
        expect(res?.headers.get('cache-control')).toBe(
            `public, max-age=${DEFAULT_ASSET_MAX_AGE}, immutable`,
        );
    });

    it('honours a custom max-age for hashed chunks', () => {
        const res = clientAsset('/_elemix/chunk-33m7cpfj.js', 3600);
        expect(res?.headers.get('cache-control')).toBe(
            'public, max-age=3600, immutable',
        );
    });

    it('revalidates stable-named entry bundles', () => {
        const res = clientAsset('/_elemix/HomePage.js');
        expect(res?.headers.get('cache-control')).toBe('no-cache');
    });

    it('serves a javascript content-type', () => {
        expect(
            clientAsset('/_elemix/HomePage.js')?.headers.get('content-type'),
        ).toContain('javascript');
    });
});
