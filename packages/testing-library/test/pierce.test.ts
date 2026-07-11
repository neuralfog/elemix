import { afterEach, describe, expect, it } from 'vitest';
import { pierce, pierceAll } from '../src/pierce';

const mount = (html: string): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
};

const withShadow = (tag: string, inner = ''): HTMLElement => {
    const el = document.createElement(tag);
    el.attachShadow({ mode: 'open' }).innerHTML = inner;
    return el;
};

afterEach(() => {
    document.body.innerHTML = '';
});

describe('pierce - light DOM', () => {
    it('finds a direct child', () => {
        mount('<button class="go">go</button>');
        expect(pierce('.go')?.textContent).toBe('go');
    });

    it('finds a deeply nested element', () => {
        mount('<section><div><p><em class="deep">x</em></p></div></section>');
        expect(pierce('.deep')?.textContent).toBe('x');
    });

    it('returns null when nothing matches', () => {
        mount('<div class="present"></div>');
        expect(pierce('.absent')).toBeNull();
    });

    it('returns the first match in document order', () => {
        mount('<i class="hit">a</i><i class="hit">b</i>');
        expect(pierce('.hit')?.textContent).toBe('a');
    });
});

describe('pierce - shadow piercing', () => {
    it('pierces a single boundary', () => {
        const el = withShadow('x-card', '<span class="title">hi</span>');
        document.body.appendChild(el);
        expect(pierce('.title')?.textContent).toBe('hi');
    });

    it('pierces two nested boundaries', () => {
        const inner = withShadow('x-inner', '<b class="deep">deep</b>');
        const outer = withShadow('x-outer');
        outer.shadowRoot?.appendChild(inner);
        document.body.appendChild(outer);
        expect(pierce('.deep')?.textContent).toBe('deep');
    });

    it('pierces three nested boundaries', () => {
        const c = withShadow('x-c', '<u class="core">core</u>');
        const b = withShadow('x-b');
        const a = withShadow('x-a');
        b.shadowRoot?.appendChild(c);
        a.shadowRoot?.appendChild(b);
        document.body.appendChild(a);
        expect(pierce('.core')?.textContent).toBe('core');
    });

    it('finds a match across sibling shadow hosts', () => {
        const a = withShadow('x-a', '<span class="only-b"></span>');
        const b = withShadow('x-b', '<span class="target">found</span>');
        document.body.append(a, b);
        expect(pierce('.target')?.textContent).toBe('found');
    });

    it('searches a hosts light children and its shadow tree', () => {
        const el = withShadow('x-slotted', '<span class="in-shadow">s</span>');
        el.innerHTML = '<span class="in-light">l</span>';
        document.body.appendChild(el);
        expect(pierce('.in-light')?.textContent).toBe('l');
        expect(pierce('.in-shadow')?.textContent).toBe('s');
    });

    it('continues past an empty shadow root', () => {
        const empty = withShadow('x-empty');
        const filled = withShadow('x-filled', '<span class="late">late</span>');
        document.body.append(empty, filled);
        expect(pierce('.late')?.textContent).toBe('late');
    });
});

describe('pierce - ordering across boundaries', () => {
    it('prefers a light DOM match over a shadow match', () => {
        mount('<span class="hit">light</span>');
        const el = withShadow('x-card', '<span class="hit">shadow</span>');
        document.body.appendChild(el);
        expect(pierce('.hit')?.textContent).toBe('light');
    });

    it('prefers the first shadow host in document order', () => {
        const a = withShadow('x-a', '<span class="hit">first</span>');
        const b = withShadow('x-b', '<span class="hit">second</span>');
        document.body.append(a, b);
        expect(pierce('.hit')?.textContent).toBe('first');
    });

    it('prefers a shallow shadow match over a deeper nested one', () => {
        const inner = withShadow('x-inner', '<span class="hit">deep</span>');
        const outer = withShadow('x-outer', '<span class="hit">shallow</span>');
        outer.shadowRoot?.appendChild(inner);
        document.body.appendChild(outer);
        expect(pierce('.hit')?.textContent).toBe('shallow');
    });
});

describe('pierce - selector support', () => {
    it('matches by id', () => {
        const el = withShadow('x-card', '<div id="root">by-id</div>');
        document.body.appendChild(el);
        expect(pierce('#root')?.textContent).toBe('by-id');
    });

    it('matches by attribute', () => {
        const el = withShadow('x-card', '<input data-testid="email" />');
        document.body.appendChild(el);
        expect(pierce('[data-testid="email"]')).not.toBeNull();
    });

    it('matches a compound selector', () => {
        const el = withShadow(
            'x-card',
            '<button class="btn primary">ok</button>',
        );
        document.body.appendChild(el);
        expect(pierce('button.btn.primary')?.textContent).toBe('ok');
    });

    it('matches a child combinator within one shadow tree', () => {
        const el = withShadow('x-card', '<ul><li class="item">a</li></ul>');
        document.body.appendChild(el);
        expect(pierce('ul > .item')?.textContent).toBe('a');
    });

    it('matches an nth-child selector', () => {
        const el = withShadow(
            'x-list',
            '<li>one</li><li>two</li><li>three</li>',
        );
        document.body.appendChild(el);
        expect(pierce('li:nth-child(2)')?.textContent).toBe('two');
    });

    it('matches a grouped selector', () => {
        const el = withShadow('x-card', '<b class="bold">b</b>');
        document.body.appendChild(el);
        expect(pierce('.missing, .bold')?.textContent).toBe('b');
    });

    it('does not match a descendant combinator across a shadow boundary', () => {
        mount('<div class="outer"></div>');
        const el = withShadow('x-card', '<span class="inner">x</span>');
        document.querySelector('.outer')?.appendChild(el);
        expect(pierce('.outer .inner')).toBeNull();
    });
});

describe('pierce - typing', () => {
    it('carries the element type through the generic', () => {
        const el = withShadow('x-card', '<input class="field" value="v" />');
        document.body.appendChild(el);
        const field = pierce<HTMLInputElement>('.field');
        expect(field?.value).toBe('v');
    });

    it('defaults to Element', () => {
        mount('<div class="node"></div>');
        const node = pierce('.node');
        expect(node).toBeInstanceOf(Element);
    });
});

describe('pierceAll', () => {
    const texts = (els: Element[]): (string | null)[] =>
        els.map((el) => el.textContent);

    it('collects every light DOM match in document order', () => {
        mount('<i class="x">a</i><i class="x">b</i><i class="x">c</i>');
        expect(texts(pierceAll('.x'))).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array when nothing matches', () => {
        mount('<div></div>');
        expect(pierceAll('.x')).toEqual([]);
    });

    it('collects matches from within a shadow root', () => {
        const el = withShadow('x-a', '<i class="x">s1</i><i class="x">s2</i>');
        document.body.appendChild(el);
        expect(texts(pierceAll('.x'))).toEqual(['s1', 's2']);
    });

    it('collects across sibling shadow hosts in order', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b', '<i class="x">b</i>');
        document.body.append(a, b);
        expect(texts(pierceAll('.x'))).toEqual(['a', 'b']);
    });

    it('collects light matches before shadow matches', () => {
        mount('<i class="x">L1</i><i class="x">L2</i>');
        const el = withShadow('x-a', '<i class="x">S1</i>');
        document.body.appendChild(el);
        expect(texts(pierceAll('.x'))).toEqual(['L1', 'L2', 'S1']);
    });

    it('collects nested shadow matches breadth-first', () => {
        const inner = withShadow('x-in', '<i class="x">inner</i>');
        const outer = withShadow('x-out', '<i class="x">outer</i>');
        outer.shadowRoot?.appendChild(inner);
        document.body.appendChild(outer);
        expect(texts(pierceAll('.x'))).toEqual(['outer', 'inner']);
    });

    it('carries the element type through the generic', () => {
        const el = withShadow('x-a', '<input class="f" value="v" />');
        document.body.appendChild(el);
        expect(pierceAll<HTMLInputElement>('.f')[0].value).toBe('v');
    });
});
