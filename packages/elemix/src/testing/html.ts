const VOID_ELEMENTS = new Set<string>([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
]);

const INLINE = new Set<string>([
    'a',
    'abbr',
    'area',
    'b',
    'bdi',
    'bdo',
    'br',
    'button',
    'cite',
    'code',
    'data',
    'datalist',
    'del',
    'dfn',
    'em',
    'i',
    'input',
    'ins',
    'kbd',
    'keygen',
    'label',
    'map',
    'mark',
    'meter',
    'noscript',
    'output',
    'progress',
    'q',
    'ruby',
    's',
    'samp',
    'select',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'template',
    'textarea',
    'time',
    'u',
    'var',
    'wbr',
]);

const isElementBlock = (el: Element): boolean =>
    !INLINE.has(el.tagName.toLowerCase());

const hasBlockChild = (el: Element): boolean => {
    for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === 1 && isElementBlock(child as Element))
            return true;
    }
    return false;
};

const isWhitespaceText = (node: Node): boolean =>
    node.nodeType === 3 && !(node.nodeValue ?? '').trim();

const BOOLEAN_ATTRS = new Set<string>([
    'allowfullscreen',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formnovalidate',
    'hidden',
    'inert',
    'ismap',
    'itemscope',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'selected',
]);

const escAttr = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const serializeAttrs = (el: Element): string => {
    let out = '';
    for (const attr of Array.from(el.attributes)) {
        if (attr.value === '' && BOOLEAN_ATTRS.has(attr.name)) {
            out += ` ${attr.name}`;
        } else {
            out += ` ${attr.name}="${escAttr(attr.value)}"`;
        }
    }
    return out;
};

const findContentNeighbor = (
    kids: Node[],
    start: number,
    delta: number,
): Node | null => {
    let i = start + delta;
    while (i >= 0 && i < kids.length) {
        const n = kids[i];
        if (n.nodeType === 8) {
            i += delta;
            continue;
        }
        if (n.nodeType === 3) {
            const v = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
            if (v) return n;
            i += delta;
            continue;
        }
        return n;
    }
    return null;
};

const serializeInlineContent = (childNodes: Node[]): string => {
    const kids = Array.from(childNodes);
    let out = '';
    for (let i = 0; i < kids.length; i++) {
        const child = kids[i];
        if (child.nodeType === 3) {
            let v = (child.nodeValue ?? '').replace(/\s+/g, ' ');
            const prevContent = findContentNeighbor(kids, i, -1);
            const nextContent = findContentNeighbor(kids, i, 1);
            if (!prevContent || prevContent.nodeType !== 3) {
                v = v.replace(/^ /, '');
            }
            if (!nextContent || nextContent.nodeType !== 3) {
                v = v.replace(/ $/, '');
            }
            if (v === '') continue;
            out += v;
        } else if (child.nodeType === 8) {
            out += `<!--${child.nodeValue}-->`;
        } else if (child.nodeType === 1) {
            const el = child as Element;
            const tag = el.tagName.toLowerCase();
            const attrs = serializeAttrs(el);
            if (VOID_ELEMENTS.has(tag)) {
                out += `<${tag}${attrs}>`;
            } else {
                const inner = serializeInlineContent(Array.from(el.childNodes));
                out += `<${tag}${attrs}>${inner}</${tag}>`;
            }
        }
    }
    return out;
};

const serializeBlock = (el: Element, depth: number): string => {
    const tag = el.tagName.toLowerCase();
    const attrs = serializeAttrs(el);
    if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`;

    if (!hasBlockChild(el)) {
        const inner = serializeInlineContent(Array.from(el.childNodes));
        return `<${tag}${attrs}>${inner}</${tag}>`;
    }

    const childIndent = '  '.repeat(depth + 1);
    const myIndent = '  '.repeat(depth);
    let out = `<${tag}${attrs}>`;

    const inlineRun: Node[] = [];
    const flushInline = (): void => {
        if (inlineRun.length === 0) return;
        out += serializeInlineContent(inlineRun);
        inlineRun.length = 0;
    };

    for (const child of Array.from(el.childNodes)) {
        if (isWhitespaceText(child)) continue;
        if (child.nodeType === 1 && isElementBlock(child as Element)) {
            flushInline();
            out += `\n${childIndent}${serializeBlock(child as Element, depth + 1)}`;
        } else {
            inlineRun.push(child);
        }
    }
    flushInline();
    out += `\n${myIndent}</${tag}>`;
    return out;
};

const prettifyHTML = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let out = '\n';
    for (const child of Array.from(doc.body.childNodes)) {
        if (isWhitespaceText(child)) continue;
        if (child.nodeType === 1) {
            out += `${serializeBlock(child as Element, 0)}\n`;
        } else if (child.nodeType === 8) {
            out += `<!--${child.nodeValue}-->\n`;
        } else if (child.nodeType === 3) {
            const v = child.nodeValue ?? '';
            if (v.trim()) out += `${v}\n`;
        }
    }
    return out;
};

const extractHTML = (node: any): string => {
    if (!node) return '';
    if (node.nodeType === 3 && node.textContent) return node.textContent.trim();
    if (node.nodeType !== 1) return '';

    let html = '';
    const outer = node.cloneNode();
    if (node.shadowRoot) html += '\n<!-- #shadowroot -->\n';
    // biome-ignore lint:
    node = node.shadowRoot || node;

    if (node.children.length) {
        for (const n of node.childNodes) {
            if (n.assignedNodes) {
                if (n.assignedNodes()[0]) {
                    if (n.nodeName.includes('-')) {
                        html += `\n${extractHTML(n.assignedNodes()[0])}\n`;
                    } else {
                        html += extractHTML(n.assignedNodes()[0]);
                    }
                } else {
                    if (n.nodeName.includes('-')) {
                        html += `\n${n.innerHTML}\n`;
                    } else {
                        html += n.innerHTML;
                    }
                }
            } else {
                if (n.nodeName.includes('-')) {
                    html += `\n${extractHTML(n)}\n`;
                } else {
                    html += extractHTML(n);
                }
            }
        }
    } else {
        html = node.innerHTML;
    }

    outer.innerHTML = html;
    return outer.outerHTML;
};

export const HTML = (element: HTMLElement): string => {
    return prettifyHTML(extractHTML(element));
};
