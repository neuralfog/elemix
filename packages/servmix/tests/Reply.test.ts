import { describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';

describe('Reply', () => {
    it('builds an html response', async () => {
        const res = Reply.html('<h1>hi</h1>').toResponse();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(await res.text()).toBe('<h1>hi</h1>');
    });

    it('builds a text response', async () => {
        const res = Reply.text('plain').toResponse();
        expect(res.headers.get('content-type')).toContain('text/plain');
        expect(await res.text()).toBe('plain');
    });

    it('builds a json response', async () => {
        const res = Reply.json({ ok: true }).toResponse();
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ ok: true });
    });

    it('sets a chosen status', async () => {
        const res = Reply.text('made').status(201).toResponse();
        expect(res.status).toBe(201);
    });

    it('sets a custom header', () => {
        const res = Reply.text('x').header('x-test', 'yes').toResponse();
        expect(res.headers.get('x-test')).toBe('yes');
    });

    it('chains status and header fluently', () => {
        const res = Reply.html('<p>no</p>')
            .status(404)
            .header('x-a', '1')
            .toResponse();
        expect(res.status).toBe(404);
        expect(res.headers.get('x-a')).toBe('1');
        expect(res.headers.get('content-type')).toContain('text/html');
    });

    it('builds a redirect', () => {
        const res = Reply.redirect('/login').toResponse();
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('/login');
    });
});
