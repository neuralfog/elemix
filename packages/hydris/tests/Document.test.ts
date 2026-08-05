import { afterEach, describe, expect, it } from 'bun:test';
import { App } from '../src/App';
import { Reply } from '../src/http/Reply';
import { setDefaultDocument } from '../src/render/render';
import { AltFrame } from './fixtures/AltFrame';
import { BarePage } from './fixtures/BarePage';
import { DocFrame } from './fixtures/DocFrame';
import { DocPage } from './fixtures/DocPage';

const render = (reply: Reply): Promise<string> => reply.toResponse().text();

describe('document cascade', () => {
    afterEach(() => {
        setDefaultDocument(undefined);
    });

    it('renders a bare component with no document frame', async () => {
        const html = await render(Reply.view(BarePage));
        expect(html).not.toContain('<!doctype html>');
        expect(html).toContain('<bare-page>');
        expect(html).toContain('<p>bare</p>');
        expect(html).toContain('/_elemix/BarePage.js');
    });

    it('wraps a page in its field-declared document', async () => {
        const html = await render(Reply.view(DocPage));
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('<title>Doc Frame</title>');
        expect(html).toContain('id="chrome"');
        expect(html).toContain('<doc-page>');
        expect(html).not.toContain('<slot></slot>');
        expect(html).toContain('</body></html>');
    });

    it('lets a .document() override beat the field-declared document', async () => {
        const html = await render(Reply.view(DocPage).document(AltFrame));
        expect(html).toContain('<title>Alt Frame</title>');
        expect(html).toContain('id="alt"');
        expect(html).not.toContain('Doc Frame');
        expect(html).toContain('<doc-page>');
    });

    it('falls back to the global App.document default', async () => {
        App.document(DocFrame);
        const html = await render(Reply.view(BarePage));
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('<title>Doc Frame</title>');
        expect(html).toContain('<bare-page>');
    });

    it('prefers the field-declared document over the global default', async () => {
        App.document(AltFrame);
        const html = await render(Reply.view(DocPage));
        expect(html).toContain('<title>Doc Frame</title>');
        expect(html).not.toContain('Alt Frame');
    });

    it('emits the document client script before the page script', async () => {
        const html = await render(Reply.view(DocPage));
        const docIdx = html.indexOf('/_elemix/DocFrame.js');
        const pageIdx = html.indexOf('/_elemix/DocPage.js');
        expect(docIdx).toBeGreaterThan(-1);
        expect(pageIdx).toBeGreaterThan(-1);
        expect(docIdx).toBeLessThan(pageIdx);
    });
});
