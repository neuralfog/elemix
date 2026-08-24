import { describe, expect, it } from 'bun:test';
import { Reply } from '../src/http/Reply';
import { BarePage } from './fixtures/BarePage';

const render = (reply: Reply): Promise<string> => reply.toResponse().text();

describe('elemix client script', () => {
    it('emits the bundle url via the manifest, with no ?v= query', async () => {
        const html = await render(Reply.view(BarePage));
        expect(html).toContain('/_elemix/BarePage.js"');
        expect(html).not.toContain('?v=');
    });
});
