import { describe, test, expect, beforeEach, vi } from 'vitest';
import { html } from '@neuralfog/elemix/render';
import { elemixDecorator } from './elemixDecorator';

let idCounter = 0;

const run = (
    story: (ctx: unknown) => unknown,
    parameters: Record<string, unknown> = {},
    id = `story-${idCounter++}`,
): HTMLElement => {
    const decorator = elemixDecorator as unknown as (
        s: (ctx: unknown) => unknown,
        c: { id: string; args: unknown; parameters: Record<string, unknown> },
    ) => HTMLElement;
    return decorator(story, { id, args: {}, parameters });
};

describe('elemixDecorator', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('renders the story template into a [data-elemix-root] host', () => {
        const host = run(() => html`<p>hello ${'world'}</p>`);

        expect(host.getAttribute('data-elemix-root')).toBe('');
        expect(host.querySelector('p')?.textContent).toBe('hello world');
    });

    test('mounts into #storybook-root and clears prior content', () => {
        const root = document.createElement('div');
        root.id = 'storybook-root';
        root.innerHTML = '<span>stale</span>';
        document.body.appendChild(root);

        run(() => html`<b>fresh</b>`);

        expect(root.querySelector('span')).toBeNull();
        expect(root.querySelector('[data-elemix-root] b')?.textContent).toBe(
            'fresh',
        );
    });

    test('falls back to document.body when #storybook-root is absent', () => {
        const host = run(() => html`<i>x</i>`);
        expect(host.parentElement).toBe(document.body);
    });

    test('runs beforeRender before render and afterRender after', () => {
        const calls: string[] = [];

        run(
            () => {
                calls.push('render');
                return html`<i>x</i>`;
            },
            {
                elemix: {
                    beforeRender: () => calls.push('before'),
                    afterRender: () => calls.push('after'),
                },
            },
        );

        expect(calls).toEqual(['before', 'render', 'after']);
    });

    test('runs setup only once per story id', () => {
        const setup = vi.fn(() => () => {});

        run(() => html`<i>a</i>`, { elemix: { setup } }, 'shared-id');
        run(() => html`<i>b</i>`, { elemix: { setup } }, 'shared-id');

        expect(setup).toHaveBeenCalledTimes(1);
    });
});
