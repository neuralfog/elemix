import { beforeEach, describe, expect, test } from 'vitest';
import { elemixDecorator } from './elemixDecorator';

let idCounter = 0;

// The decorator mounts a story result that is a string or a Node. Build real
// DOM nodes directly — elemix is compile-only, there is no tpl`` interpreter.
const node = (markup: string): Node => {
    const t = document.createElement('template');
    t.innerHTML = markup;
    return t.content.firstChild as Node;
};

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

    test('renders a Node story into a [data-elemix-root] host', () => {
        const host = run(() => node('<p>hello world</p>'));

        expect(host.getAttribute('data-elemix-root')).toBe('');
        expect(host.querySelector('p')?.textContent).toBe('hello world');
    });

    test('renders a string story via innerHTML', () => {
        const host = run(() => '<p>hello world</p>');

        expect(host.querySelector('p')?.textContent).toBe('hello world');
    });

    test('returns a detached host for Storybook to mount', () => {
        const host = run(() => node('<i>x</i>'));
        expect(host.parentElement).toBeNull();
    });

    test('does not touch #storybook-root', () => {
        const root = document.createElement('div');
        root.id = 'storybook-root';
        root.innerHTML = '<span>stale</span>';
        document.body.appendChild(root);

        run(() => node('<b>fresh</b>'));

        // the canvas is left untouched - Storybook mounts the returned host
        // itself, so the decorator must not disturb any existing tree.
        expect(root.querySelector('span')?.textContent).toBe('stale');
        expect(root.querySelector('[data-elemix-root]')).toBeNull();
    });

    test('runs beforeRender before render and afterRender after', () => {
        const calls: string[] = [];

        run(
            () => {
                calls.push('render');
                return node('<i>x</i>');
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
});
