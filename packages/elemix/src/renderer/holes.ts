import {
    Attr,
    KEYED_LIST,
    type AttrDef,
    type Fragment,
    type Hole,
    type HtmlTemplate,
    type KeyedList,
} from './types';
import { diff } from './diff';
import { makeMarker, mergeClasses } from './utils';

let dirty = false;

export const resetDirty = (): void => {
    dirty = false;
};

export const readDirty = (): boolean => dirty;

const markDirty = (): void => {
    dirty = true;
};

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
    } else if (p === '~' && name.startsWith('~onmodel')) {
        def.virtual = true;
        def.type = Attr.ONMODEL;
    } else if (p === '~' && name.startsWith('~model')) {
        def.virtual = true;
        def.type = Attr.MODEL;
    } else if (p === '.') {
        def.virtual = true;
        def.type = name.startsWith('.class')
            ? Attr.DIRECT_CLASS
            : Attr.DIRECT_PROP;
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

export const applyAttribute = (
    node: HTMLElement,
    def: AttrDef,
    holes: Map<number, Hole>,
): void => {
    if (def.virtual) node.removeAttribute(def.name);
    holes.set(def.index, ATTR_DISPATCH[def.type](node, def));
};

type MkFrag = (t: HtmlTemplate) => Fragment;

type ContentSubHole = { update: Hole; dispose: () => void };
type Kind = 'list' | 'template' | 'string';

const isKeyedList = (v: unknown): v is KeyedList =>
    typeof v === 'object' && v !== null && (v as KeyedList)[KEYED_LIST] === true;

const kindOf = (v: unknown): Kind =>
    Array.isArray(v) || isKeyedList(v)
        ? 'list'
        : isTemplate(v)
          ? 'template'
          : 'string';

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
            if (node.textContent !== s) {
                node.textContent = s;
                markDirty();
            }
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
        if (nodes.length) markDirty();
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
                markDirty();
            }
            frag.update(t.values);
        },
        dispose: clear,
    };
};

const listHole = (anchor: Comment, mk: MkFrag): ContentSubHole => {
    const frags = new Map<string, Fragment>();
    // Each keyed item may mount more than one top-level node (multiple root
    // elements, or text nodes from surrounding whitespace), so track the full
    // node set per key — not just one node — for correct removal and movement.
    const nodeMap = new Map<string, ChildNode[]>();
    let prev: HtmlTemplate[] = [];

    let memoCache = new Map<string, { memo: unknown; tpl: HtmlTemplate }>();

    const buildItems = (
        spec: KeyedList,
    ): { items: HtmlTemplate[]; reused: Set<string> } => {
        const { list, cb, keyFn, memoFn } = spec;
        const out: HtmlTemplate[] = new Array(list.length);
        const next = new Map<string, { memo: unknown; tpl: HtmlTemplate }>();
        const reused = new Set<string>();
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const k = keyFn?.(item, i) || String(i);
            const m = memoFn(item, i);
            const hit = memoCache.get(k);
            let tpl: HtmlTemplate;
            if (hit && hit.memo === m) {
                tpl = hit.tpl;
                reused.add(k);
            } else {
                tpl = cb(item, i);
                tpl.key = k;
            }
            next.set(k, { memo: m, tpl });
            out[i] = tpl;
        }
        memoCache = next;
        return { items: out, reused };
    };

    // The leading node of an item, used as the insertion anchor so a new or
    // moved item lands before the whole target item rather than between its
    // nodes. Undefined key (end of list) falls back to the list anchor.
    const firstNode = (key: string | undefined): ChildNode | undefined => {
        const nodes = key !== undefined ? nodeMap.get(key) : undefined;
        return nodes?.length ? nodes[0] : undefined;
    };

    const removeNodes = (key: string): void => {
        const nodes = nodeMap.get(key);
        if (nodes) for (let i = 0; i < nodes.length; i++) nodes[i].remove();
    };

    const mountItem = (t: HtmlTemplate, before?: ChildNode): Fragment => {
        if (!t.key) {
            throw new Error('use repeat directive when rendering the lists');
        }

        let frag = frags.get(t.key);
        if (!frag) {
            frag = mk(t);
            frags.set(t.key, frag);
            const ref = before || anchor;
            nodeMap.set(t.key, frag.mountBefore(ref, t.values));
            markDirty();
        }
        return frag;
    };

    const clear = (): void => {
        if (nodeMap.size) markDirty();
        for (const [k] of nodeMap) removeNodes(k);
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
            let items: HtmlTemplate[];
            let skip: Set<string> | undefined;
            if (isKeyedList(v)) {
                const built = buildItems(v);
                items = built.items;
                skip = built.reused;
            } else {
                items = v as HtmlTemplate[];
            }

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

            if (deletes.length) markDirty();
            for (let i = deletes.length - 1; i >= 0; i--) {
                const k = deletes[i].key;
                removeNodes(k);
                nodeMap.delete(k);
                frags.delete(k);
            }

            if (moves.length) markDirty();
            for (let i = moves.length - 1; i >= 0; i--) {
                const nodes = nodeMap.get(moves[i].key);
                if (!nodes) continue;
                const before = firstNode(moves[i].beforeKey) || anchor;
                for (let j = 0; j < nodes.length; j++) before.before(nodes[j]);
            }

            for (let i = inserts.length - 1; i >= 0; i--) {
                mountItem(inserts[i].value, firstNode(inserts[i].beforeKey));
            }

            for (let i = 0; i < items.length; i++) {
                if (skip?.has(items[i].key)) continue;
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
        markDirty();
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
        if (el.$props) {
            el.$props.set(prop, v);
            return;
        }
        // Custom element not upgraded yet (e.g. when a parent template is
        // cloned, child custom elements aren't upgraded until insertion). Buffer
        // the prop on the node so $props.initialize() can drain it on first
        // connection — before beforeMount() or template() run.
        if (!el.__pendingProps) el.__pendingProps = {};
        el.__pendingProps[prop] = v;
    };
};

type OnModelNode = HTMLElement & { __onmodel?: (v: string) => string };

const modelHole = (node: HTMLElement): Hole => {
    const input = node as HTMLInputElement;
    return (v) => {
        if (v === undefined) return;
        const m = v as { value: string };
        if (input.value !== m.value) {
            input.value = m.value;
            markDirty();
        }

        if (!node.oninput) {
            node.oninput = () => {
                if (input.value === m.value) return;
                const onmodel = (node as OnModelNode).__onmodel;
                if (onmodel) input.value = onmodel(input.value);
                m.value = input.value;
            };
        }
    };
};

const onModelHole = (node: HTMLElement): Hole => {
    return (v) => {
        (node as OnModelNode).__onmodel =
            typeof v === 'function' ? (v as (s: string) => string) : undefined;
    };
};

const refHole = (node: HTMLElement): Hole => {
    return (v) => {
        if (v !== undefined) (v as { value?: unknown }).value = node;
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
                markDirty();
            }
            return;
        }

        if (typeof v === 'string') {
            const next = mergeClasses(initClass, v);
            if (last !== next) {
                last = next;
                node.setAttribute('class', next);
                markDirty();
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
                markDirty();
            }
        }
    };
};

const directPropHole = (node: HTMLElement, def: AttrDef): Hole => {
    const prop = def.name.slice(1);
    let last: unknown;
    return (v) => {
        if (last === v) return;
        last = v;
        (node as unknown as Record<string, unknown>)[prop] = v;
    };
};

const ATTR_DISPATCH: Record<number, (n: HTMLElement, d: AttrDef) => Hole> = {
    [Attr.STD]: stdAttrHole,
    [Attr.EVENT]: eventHole,
    [Attr.PROP]: propHole,
    [Attr.MODEL]: (n) => modelHole(n),
    [Attr.ONMODEL]: (n) => onModelHole(n),
    [Attr.REF]: (n) => refHole(n),
    [Attr.DIRECT_CLASS]: (n) => directClassHole(n),
    [Attr.DIRECT_PROP]: directPropHole,
};
