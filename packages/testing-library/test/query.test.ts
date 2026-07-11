import { afterEach, describe, expect, it } from 'vitest';
import {
    find,
    findByTestId,
    findFirst,
    findLast,
    query,
    queryByTestId,
} from '../src/query';

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

const texts = (els: Element[]): (string | null)[] =>
    els.map((el) => el.textContent);

afterEach(() => {
    document.body.innerHTML = '';
});

describe('query - multi', () => {
    it('returns all light DOM matches in document order', () => {
        mount('<i class="x">a</i><i class="x">b</i><i class="x">c</i>');
        expect(texts(query('.x'))).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array when nothing matches', () => {
        mount('<div class="present"></div>');
        expect(query('.absent')).toEqual([]);
    });

    it('always returns a real array', () => {
        expect(Array.isArray(query('.nothing'))).toBe(true);
    });

    it('collects matches from inside a shadow root', () => {
        const el = withShadow('x-a', '<i class="x">s1</i><i class="x">s2</i>');
        document.body.appendChild(el);
        expect(texts(query('.x'))).toEqual(['s1', 's2']);
    });

    it('collects across sibling shadow hosts', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b', '<i class="x">b</i>');
        document.body.append(a, b);
        expect(texts(query('.x'))).toEqual(['a', 'b']);
    });

    it('collects across nested shadow boundaries', () => {
        const inner = withShadow('x-in', '<i class="x">inner</i>');
        const outer = withShadow('x-out', '<i class="x">outer</i>');
        outer.shadowRoot?.appendChild(inner);
        document.body.appendChild(outer);
        expect(texts(query('.x'))).toEqual(['outer', 'inner']);
    });

    it('orders light DOM matches before shadow matches', () => {
        mount('<i class="x">L1</i><i class="x">L2</i>');
        const el = withShadow('x-a', '<i class="x">S1</i>');
        document.body.appendChild(el);
        expect(texts(query('.x'))).toEqual(['L1', 'L2', 'S1']);
    });

    it('carries the element type through the generic', () => {
        const el = withShadow('x-a', '<input class="f" value="v" />');
        document.body.appendChild(el);
        const inputs = query<HTMLInputElement>('.f');
        expect(inputs[0].value).toBe('v');
    });
});

describe('find - single', () => {
    it('finds a light DOM element', () => {
        mount('<button class="go">go</button>');
        expect(find('.go')?.textContent).toBe('go');
    });

    it('pierces a shadow boundary', () => {
        const el = withShadow('x-a', '<span class="title">hi</span>');
        document.body.appendChild(el);
        expect(find('.title')?.textContent).toBe('hi');
    });

    it('returns null when nothing matches', () => {
        mount('<div class="present"></div>');
        expect(find('.absent')).toBeNull();
    });

    it('returns the first match in document order', () => {
        mount('<i class="x">a</i><i class="x">b</i>');
        expect(find('.x')?.textContent).toBe('a');
    });

    it('prefers a light DOM match over a shadow match', () => {
        mount('<span class="x">light</span>');
        const el = withShadow('x-a', '<span class="x">shadow</span>');
        document.body.appendChild(el);
        expect(find('.x')?.textContent).toBe('light');
    });

    it('carries the element type through the generic', () => {
        const el = withShadow('x-a', '<input class="f" value="v" />');
        document.body.appendChild(el);
        expect(find<HTMLInputElement>('.f')?.value).toBe('v');
    });
});

describe('findFirst', () => {
    it('returns the first of many light matches', () => {
        mount('<i class="x">a</i><i class="x">b</i>');
        expect(findFirst('.x')?.textContent).toBe('a');
    });

    it('returns the first across light and shadow', () => {
        mount('<i class="x">light</i>');
        const el = withShadow('x-a', '<i class="x">shadow</i>');
        document.body.appendChild(el);
        expect(findFirst('.x')?.textContent).toBe('light');
    });

    it('returns null when nothing matches', () => {
        mount('<div></div>');
        expect(findFirst('.x')).toBeNull();
    });

    it('agrees with the first element of query', () => {
        const el = withShadow('x-a', '<i class="x">only</i>');
        document.body.appendChild(el);
        expect(findFirst('.x')).toBe(query('.x')[0]);
    });

    it('carries the element type through the generic', () => {
        mount('<input class="f" value="v" />');
        expect(findFirst<HTMLInputElement>('.f')?.value).toBe('v');
    });
});

describe('findLast', () => {
    it('returns the last of many light matches', () => {
        mount('<i class="x">a</i><i class="x">b</i><i class="x">c</i>');
        expect(findLast('.x')?.textContent).toBe('c');
    });

    it('returns the last across sibling shadow hosts', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b', '<i class="x">b</i>');
        document.body.append(a, b);
        expect(findLast('.x')?.textContent).toBe('b');
    });

    it('returns the deepest match across nested boundaries', () => {
        const inner = withShadow('x-in', '<i class="x">inner</i>');
        const outer = withShadow('x-out', '<i class="x">outer</i>');
        outer.shadowRoot?.appendChild(inner);
        document.body.appendChild(outer);
        expect(findLast('.x')?.textContent).toBe('inner');
    });

    it('returns the only match when there is one', () => {
        mount('<i class="x">solo</i>');
        expect(findLast('.x')?.textContent).toBe('solo');
    });

    it('returns null when nothing matches', () => {
        mount('<div></div>');
        expect(findLast('.x')).toBeNull();
    });

    it('agrees with the last element of query', () => {
        mount('<i class="x">a</i><i class="x">b</i>');
        const all = query('.x');
        expect(findLast('.x')).toBe(all[all.length - 1]);
    });
});

describe('queryByTestId - multi', () => {
    it('finds all light DOM matches for a test id', () => {
        mount(
            '<b data-testid="row">a</b><b data-testid="row">b</b><b data-testid="other">c</b>',
        );
        expect(texts(queryByTestId('row'))).toEqual(['a', 'b']);
    });

    it('pierces shadow roots', () => {
        const el = withShadow('x-a', '<b data-testid="row">s</b>');
        document.body.appendChild(el);
        expect(texts(queryByTestId('row'))).toEqual(['s']);
    });

    it('collects across boundaries in order', () => {
        mount('<b data-testid="row">L</b>');
        const el = withShadow('x-a', '<b data-testid="row">S</b>');
        document.body.appendChild(el);
        expect(texts(queryByTestId('row'))).toEqual(['L', 'S']);
    });

    it('returns an empty array when the id is absent', () => {
        mount('<b data-testid="row">a</b>');
        expect(queryByTestId('missing')).toEqual([]);
    });

    it('carries the element type through the generic', () => {
        mount('<input data-testid="field" value="v" />');
        expect(queryByTestId<HTMLInputElement>('field')[0].value).toBe('v');
    });
});

describe('findByTestId - single', () => {
    it('finds a light DOM element by test id', () => {
        mount('<b data-testid="row">a</b>');
        expect(findByTestId('row')?.textContent).toBe('a');
    });

    it('pierces a shadow boundary', () => {
        const el = withShadow('x-a', '<b data-testid="row">s</b>');
        document.body.appendChild(el);
        expect(findByTestId('row')?.textContent).toBe('s');
    });

    it('returns the first when several share the id', () => {
        mount('<b data-testid="row">a</b><b data-testid="row">b</b>');
        expect(findByTestId('row')?.textContent).toBe('a');
    });

    it('returns null when the id is absent', () => {
        mount('<b data-testid="row">a</b>');
        expect(findByTestId('missing')).toBeNull();
    });

    it('carries the element type through the generic', () => {
        mount('<input data-testid="field" value="v" />');
        expect(findByTestId<HTMLInputElement>('field')?.value).toBe('v');
    });
});

describe('native selector support', () => {
    it('matches by id', () => {
        const el = withShadow('x-a', '<div id="root">by-id</div>');
        document.body.appendChild(el);
        expect(find('#root')?.textContent).toBe('by-id');
    });

    it('matches by tag', () => {
        const el = withShadow('x-a', '<section>tag</section>');
        document.body.appendChild(el);
        expect(find('section')?.textContent).toBe('tag');
    });

    it('matches by class', () => {
        const el = withShadow('x-a', '<p class="lead">cls</p>');
        document.body.appendChild(el);
        expect(find('.lead')?.textContent).toBe('cls');
    });

    it('matches a compound selector', () => {
        const el = withShadow('x-a', '<button class="btn primary">ok</button>');
        document.body.appendChild(el);
        expect(find('button.btn.primary')?.textContent).toBe('ok');
    });

    it('matches by attribute across multiple shadow hosts', () => {
        const a = withShadow('x-a', '<input name="email" />');
        const b = withShadow('x-b', '<input name="email" />');
        document.body.append(a, b);
        expect(query('input[name="email"]').length).toBe(2);
    });
});

describe('root scoping', () => {
    it('find restricts the search to the given root', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b', '<i class="x">b</i>');
        document.body.append(a, b);
        expect(find('.x', b)?.textContent).toBe('b');
    });

    it('query restricts the collection to the given root', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b', '<i class="x">b1</i><i class="x">b2</i>');
        document.body.append(a, b);
        expect(texts(query('.x', b))).toEqual(['b1', 'b2']);
    });

    it('pierces the root element own shadow root', () => {
        const el = withShadow('x-a', '<i class="x">self</i>');
        document.body.appendChild(el);
        expect(find('.x', el)?.textContent).toBe('self');
    });

    it('finds by test id scoped to a root', () => {
        const a = withShadow('x-a', '<b data-testid="row">a</b>');
        const b = withShadow('x-b', '<b data-testid="row">b</b>');
        document.body.append(a, b);
        expect(findByTestId('row', b)?.textContent).toBe('b');
    });

    it('returns nothing for a match outside the root', () => {
        const a = withShadow('x-a', '<i class="x">a</i>');
        const b = withShadow('x-b');
        document.body.append(a, b);
        expect(query('.x', b)).toEqual([]);
        expect(find('.x', b)).toBeNull();
    });
});
