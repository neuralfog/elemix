import {
    Attr,
    type AttrDef,
    type Fragment,
    type Hole,
    type HtmlTemplate,
} from './types';
import { diff } from './diff';
import { camelToKebab, makeMarker, mergeClasses } from './utils';

export const isTemplate = (v: unknown): v is HtmlTemplate =>
    v !== null &&
    v !== undefined &&
    typeof v === 'object' &&
    'strings' in v &&
    'values' in v;

const ATTR_RE = /(\S+)(?==(?:["']?)$)/;

export const detectAttribute = (
    raw: string,
    index: number,
): AttrDef | undefined => {
    const m = raw.match(ATTR_RE);
    if (!m) return undefined;

    const name = m[1];
    const def: AttrDef = {
        index,
        name,
        value: makeMarker(index),
        virtual: false,
        type: Attr.STD,
    };
    const p = name[0];

    if (p === '@') {
        def.virtual = true;
        def.type = Attr.EVENT;
    } else if (p === ':') {
        def.virtual = true;
        def.type = name.endsWith(':ref') ? Attr.REF : Attr.PROP;
    } else if (p === '~' && name.startsWith('~model')) {
        def.virtual = true;
        def.type = Attr.MODEL;
    } else if (p === '.') {
        if (name.startsWith('.bind-attrs')) {
            def.virtual = true;
            def.type = Attr.BIND_ATTRS;
        } else if (name.startsWith('.bind-events')) {
            def.virtual = true;
            def.type = Attr.BIND_EVENTS;
        } else if (name.startsWith('.class')) {
            def.virtual = true;
            def.type = Attr.DIRECT_CLASS;
        }
    }

    return def;
};

const escCache = new Map<string, string>();

const escAttr = (name: string): string => {
    const hit = escCache.get(name);
    if (hit) return hit;
    let out = '';
    for (let i = 0; i < name.length; i++) {
        const ch = name[i];
        const c = ch.charCodeAt(0);
        out +=
            (c >= 48 && c <= 57) ||
            (c >= 65 && c <= 90) ||
            (c >= 97 && c <= 122) ||
            ch === '-' ||
            ch === '_'
                ? ch
                : `\\${ch}`;
    }
    escCache.set(name, out);
    return out;
};

export const hydrateAttributes = (
    frag: DocumentFragment,
    attrs: AttrDef[],
    holes: Map<number, Hole>,
): void => {
    for (let i = 0, len = attrs.length; i < len; i++) {
        const d = attrs[i];
        const node = frag.querySelector<HTMLElement>(
            `[${escAttr(d.name)}='${d.value}']`,
        );
        if (!node) continue;
        if (d.virtual) node.removeAttribute(d.name);
        holes.set(d.index, ATTR_DISPATCH[d.type](node, d));
    }
};

type MkFrag = (t: HtmlTemplate) => Fragment;

type ContentSubHole = { update: Hole; dispose: () => void };
type Kind = 'list' | 'template' | 'string';

const kindOf = (v: unknown): Kind =>
    Array.isArray(v) ? 'list' : isTemplate(v) ? 'template' : 'string';

const createSubHole = (
    kind: Kind,
    anchor: Comment,
    mk: MkFrag,
): ContentSubHole =>
    kind === 'list'
        ? listHole(anchor, mk)
        : kind === 'template'
          ? templateHole(anchor, mk)
          : stringHole(anchor);

export const createContentHole = (
    _value: unknown,
    anchor: Comment,
    mk: MkFrag,
): Hole => {
    let current: ContentSubHole | undefined;
    let currentKind: Kind | undefined;

    return (v) => {
        const kind = kindOf(v);
        if (currentKind && currentKind !== kind) {
            current?.dispose();
            current = undefined;
        }
        if (!current) {
            current = createSubHole(kind, anchor, mk);
            currentKind = kind;
        }
        current.update(v);
    };
};

const stringHole = (anchor: Comment): ContentSubHole => {
    const node = document.createTextNode('');
    anchor.before(node);
    return {
        update: (v) => {
            const s = v != null ? String(v) : '';
            if (node.textContent !== s) node.textContent = s;
        },
        dispose: () => {
            node.remove();
        },
    };
};

const templateHole = (anchor: Comment, mk: MkFrag): ContentSubHole => {
    let prevStrings: TemplateStringsArray | undefined;
    let frag: Fragment | undefined;
    let nodes: ChildNode[] = [];

    const clear = (): void => {
        for (let i = 0; i < nodes.length; i++) nodes[i].remove();
        nodes = [];
    };

    return {
        update: (v) => {
            const t = v as HtmlTemplate;
            if (prevStrings !== t.strings) {
                frag = undefined;
                clear();
            }
            if (!frag) {
                frag = mk(t);
                prevStrings = t.strings;
                nodes = frag.mountBefore(anchor, t.values);
            }
            frag.update(t.values);
        },
        dispose: clear,
    };
};

const listHole = (anchor: Comment, mk: MkFrag): ContentSubHole => {
    const frags = new Map<string, Fragment>();
    const nodeMap = new Map<string, ChildNode>();
    let prev: HtmlTemplate[] = [];

    const mountItem = (t: HtmlTemplate, before?: ChildNode): Fragment => {
        if (!t.key) {
            throw new Error('use repeat directive when rendering the lists');
        }

        let frag = frags.get(t.key);
        if (!frag) {
            frag = mk(t);
            frags.set(t.key, frag);
            const ref = before || anchor;
            const children = frag.mountBefore(ref, t.values);
            if (children.length) {
                nodeMap.set(t.key, children[children.length - 1]);
            }
        }
        return frag;
    };

    const clear = (): void => {
        for (const [, n] of nodeMap) n.remove();
        frags.clear();
        nodeMap.clear();
    };

    const renderAll = (items: HtmlTemplate[]): void => {
        for (let i = 0; i < items.length; i++) {
            mountItem(items[i]).update(items[i].values);
        }
    };

    return {
        update: (v) => {
            const items = v as HtmlTemplate[];

            if (!prev.length) {
                renderAll(items);
                prev = items;
                return;
            }

            if (!items.length) {
                clear();
                prev = items;
                return;
            }

            const { deletes, inserts, moves } = diff(prev, items);

            if (
                deletes.length === items.length ||
                inserts.length === items.length
            ) {
                clear();
                renderAll(items);
                prev = items;
                return;
            }

            for (let i = deletes.length - 1; i >= 0; i--) {
                const k = deletes[i].key;
                nodeMap.get(k)?.remove();
                nodeMap.delete(k);
                frags.delete(k);
            }

            for (let i = moves.length - 1; i >= 0; i--) {
                const node = nodeMap.get(moves[i].key);
                const before = nodeMap.get(moves[i].beforeKey as string);
                if (node && before) before.before(node);
                else if (node) anchor.before(node);
            }

            for (let i = inserts.length - 1; i >= 0; i--) {
                const before = nodeMap.get(inserts[i].beforeKey as string);
                mountItem(inserts[i].value, before);
            }

            for (let i = 0; i < items.length; i++) {
                frags.get(items[i].key)?.update(items[i].values);
            }

            prev = items;
        },
        dispose: () => {
            clear();
            prev = [];
        },
    };
};

const stdAttrHole = (node: HTMLElement, def: AttrDef): Hole => {
    let last: string | undefined;
    const { name } = def;
    return (v) => {
        if (v === undefined) return;
        const s = String(v);
        if (last === s) return;
        last = s;
        node.setAttribute(name, s);
    };
};

const eventHole = (node: HTMLElement, def: AttrDef): Hole => {
    let last: unknown;
    const prop = `on${def.name.slice(1)}`;
    return (v) => {
        if (v === undefined || last === v) return;
        last = v;
        (node as any)[prop] = v;
    };
};

const propHole = (node: HTMLElement, def: AttrDef): Hole => {
    const prop = def.name.slice(1);
    return (v) => {
        const el = node as any;
        if (el.$props) el.$props.set(prop, v);
    };
};

const modelHole = (node: HTMLElement): Hole => {
    return (v) => {
        if (v === undefined) return;
        const m = v as { value: string };
        const input = node as HTMLInputElement;
        if (input.value !== m.value) {
            input.value = m.value;
        }
        if (!node.oninput) {
            node.oninput = (e: Event) => {
                m.value = (e.target as HTMLInputElement).value;
            };
        }
    };
};

const refHole = (node: HTMLElement): Hole => {
    return (v) => {
        if (v !== undefined) (v as { value?: unknown }).value = node;
    };
};

const bindAttrsHole = (node: HTMLElement): Hole => {
    const initClass = node.getAttribute('class') || '';
    let lastClass: string | undefined;
    return (v) => {
        if (v == null || typeof v !== 'object') return;
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            const attr = camelToKebab(k);

            if (val === undefined || val === null || val === false) {
                if (node.hasAttribute(attr)) node.removeAttribute(attr);
                if (initClass.length && lastClass !== initClass) {
                    lastClass = initClass;
                    node.setAttribute('class', initClass);
                }
                continue;
            }

            if (attr === 'class') {
                const next = mergeClasses(initClass, String(val));
                if (lastClass !== next) {
                    lastClass = next;
                    node.setAttribute('class', next);
                }
                continue;
            }

            const s = String(val);
            if (node.getAttribute(attr) !== s) node.setAttribute(attr, s);
        }
    };
};

const directClassHole = (node: HTMLElement): Hole => {
    const initClass = node.getAttribute('class') || '';
    let last: string | undefined;
    return (v) => {
        if (v == null) {
            if (initClass.length && last !== initClass) {
                last = initClass;
                node.setAttribute('class', initClass);
            }
            return;
        }

        if (typeof v === 'string') {
            const next = mergeClasses(initClass, v);
            if (last !== next) {
                last = next;
                node.setAttribute('class', next);
            }
            return;
        }

        if (typeof v === 'object') {
            let classes = '';
            for (const [cls, flag] of Object.entries(
                v as Record<string, boolean>,
            )) {
                if (flag) {
                    if (classes.length) classes += ' ';
                    classes += cls;
                }
            }
            const next = mergeClasses(initClass, classes);
            if (last !== next) {
                last = next;
                node.setAttribute('class', next);
            }
        }
    };
};

const bindEventsHole = (node: HTMLElement): Hole => {
    const prev = new Map<string, unknown>();
    return (v) => {
        if (v == null || typeof v !== 'object') return;
        for (const [name, handler] of Object.entries(
            v as Record<string, unknown>,
        )) {
            if (prev.get(name) === handler) continue;
            prev.set(name, handler);
            (node as any)[`on${name}`] = handler;
        }
    };
};

const ATTR_DISPATCH: Record<number, (n: HTMLElement, d: AttrDef) => Hole> = {
    [Attr.STD]: stdAttrHole,
    [Attr.EVENT]: eventHole,
    [Attr.PROP]: propHole,
    [Attr.MODEL]: (n) => modelHole(n),
    [Attr.REF]: (n) => refHole(n),
    [Attr.BIND_ATTRS]: (n) => bindAttrsHole(n),
    [Attr.BIND_EVENTS]: (n) => bindEventsHole(n),
    [Attr.DIRECT_CLASS]: (n) => directClassHole(n),
};
