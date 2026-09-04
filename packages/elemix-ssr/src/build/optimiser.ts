// @Todo
// Changed my mind... This need killing with fire.
//
// Find remaining optimisation opportunites baserd on compiled ssr fixtures. Onece
// proof of concept in javascript holds, mofe in to compiler behind --optimise flag
//
// @Note
//
// Optimiser for the SSR compiled sources.
//
// Aimed at the QuickJS runtime, where there is no JIT. QuickJS interprets, so it
// gets none of the runtime optimisation V8 hands you for free. Could this live in
// the compiler? Maybe. But the compiler is dumb on purpose: it takes modules and
// transforms them one at a time, and I want to keep it that way.
//
// This is a different kind of problem. It needs the whole bundle graph, not one
// module at a time, so running it in JS at build time is the right place for it.
//
// The point is simple: less work in the JS environment means a faster render,
// whatever the runtime.
//
// How the flattening works. Normally each composed child is a runtime call:
// `$__ssrChild` looks the component up by tag, constructs it, and runs its
// `$$__ssr()`, which in turn calls `$__ssrChild` for its own children. So
// rendering a page walks the whole component tree on every request, one dispatch
// per node, top to bottom.
//
// The optimiser does that walk once, at build time. It splices each child's
// rendered body straight into its parent and repeats until the tree collapses into
// a single flat strings (where possible).
//
// Married with bytecode handling instead of string sources, this buys roughly a
// 50% speed increase per render. Loading bytecode rather than parsing strings cuts
// cold start from 1ms to 0.25ms, a 75% drop, and shortens the time to response
// when the engine thrashes between bundles.
//
// Operations:
//   - Inlines a child component straight into its parent, so rendering the child
//     costs no lookup, no `new`, no extra call. Just string building.
//   - Bakes constants (css, plain string consts) straight into the template.
//   - Substitutes props: `this.props.x` becomes the value the parent passed in.
//   - Re-emits the `data-h` prop snapshot for children that hydrate on the client,
//     so nothing breaks once the runtime dispatch is gone.
//   - Folds static slot checks: `this.hasSlot('x')` is known at build time, so it
//     resolves to true or false.
//   - Leaves runtime-dependent code alone (state, before-mount, module refs and
//     client-only components stay as real runtime calls).

export type ChildMeta = {
    tag: string;
    cls: string;
    propSafe: boolean;
    simple: boolean;
    body: string;
};

const scanBalanced = (s: string, start: number): number => {
    const stack: string[] = [];
    let mode: 'code' | 'sq' | 'dq' | 'tmpl' = 'code';
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (mode === 'sq') {
            if (c === '\\') i++;
            else if (c === "'") mode = 'code';
            continue;
        }
        if (mode === 'dq') {
            if (c === '\\') i++;
            else if (c === '"') mode = 'code';
            continue;
        }
        if (mode === 'tmpl') {
            if (c === '\\') {
                i++;
                continue;
            }
            if (c === '`') {
                mode = 'code';
                continue;
            }
            if (c === '$' && s[i + 1] === '{') {
                stack.push('${');
                mode = 'code';
                i++;
                continue;
            }
            continue;
        }
        if (c === "'") {
            mode = 'sq';
            continue;
        }
        if (c === '"') {
            mode = 'dq';
            continue;
        }
        if (c === '`') {
            mode = 'tmpl';
            continue;
        }
        if (c === '(' || c === '[' || c === '{') {
            stack.push(c);
            continue;
        }
        if (c === ')' || c === ']' || c === '}') {
            const top = stack.pop();
            if (top === '${') {
                mode = 'tmpl';
                continue;
            }
            if (stack.length === 0) return i;
        }
    }
    return -1;
};

const ssrBody = (src: string, cls: string): string | null => {
    const clsAt = src.indexOf(`class ${cls}`);
    if (clsAt < 0) return null;
    const marker = src.indexOf('$$__ssr()', clsAt);
    if (marker < 0) return null;
    const next = src.indexOf('class ', clsAt + 6);
    if (next >= 0 && marker > next) return null;
    const ret = src.indexOf('return', marker);
    const open = src.indexOf('[', ret);
    if (open < 0) return null;
    const close = scanBalanced(src, open);
    if (close < 0) return null;
    return src.slice(open + 1, close);
};

const topLevelNames = (src: string, cls: string): Set<string> => {
    const names = new Set<string>();
    for (const m of src.matchAll(
        /^import\s+(?:\{([^}]*)\}|(\w+)|\*\s+as\s+(\w+))/gm,
    )) {
        if (m[1])
            for (const part of m[1].split(',')) {
                const name = part
                    .trim()
                    .split(/\s+as\s+/)
                    .pop()
                    ?.trim();
                if (name) names.add(name);
            }
        if (m[2]) names.add(m[2]);
        if (m[3]) names.add(m[3]);
    }
    for (const m of src.matchAll(/^(?:export\s+)?(?:const|let|var)\s+(\w+)/gm))
        names.add(m[1]);
    for (const m of src.matchAll(/^(?:export\s+)?function\s+(\w+)/gm))
        names.add(m[1]);
    names.delete(cls);
    names.delete('Component');
    for (const n of [...names]) if (n.startsWith('$__')) names.delete(n);
    return names;
};

const inlinableConsts = (src: string): Map<string, string> => {
    const out = new Map<string, string>();
    const re =
        /^(?:export\s+)?const\s+(\w+)\s*=\s*(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*;/gm;
    for (const m of src.matchAll(re)) {
        const raw = m[2];
        const content = raw.slice(1, -1);
        if (raw[0] === '`') {
            if (content.includes('${')) continue;
            out.set(m[1], content);
        } else {
            const unescaped = content.replace(/\\(['"])/g, '$1');
            out.set(
                m[1],
                unescaped
                    .replace(/\\/g, '\\\\')
                    .replace(/`/g, '\\`')
                    .replace(/\$\{/g, '\\${'),
            );
        }
    }
    return out;
};

export const collectMeta = (src: string): ChildMeta[] => {
    const out: ChildMeta[] = [];
    const forbidden = topLevelNames(src, '');
    const consts = inlinableConsts(src);
    const re = /\$__defineComponent\('([^']+)',\s*(\w+)\)/g;
    for (const m of src.matchAll(re)) {
        const tag = m[1];
        const cls = m[2];
        const rawBody = ssrBody(src, cls);
        if (rawBody === null) continue;
        let body = rawBody;
        for (const [name, value] of consts)
            body = body.replaceAll(`\${${name}}`, value);
        const propSafe = new RegExp(
            `${cls}\\.\\$\\$__propSafe\\s*=\\s*true`,
        ).test(src);
        const clsAt = src.indexOf(`class ${cls}`);
        const brace = clsAt < 0 ? -1 : src.indexOf('{', clsAt);
        const braceEnd = brace < 0 ? -1 : scanBalanced(src, brace);
        const region =
            clsAt < 0 || braceEnd < 0 ? src : src.slice(clsAt, braceEnd);
        const classSimple = !/\$\$__beforeMount|\$__state\b|\$\$__client/.test(
            region,
        );
        const refs = new Set(forbidden);
        refs.delete(cls);
        const bodyLocals = new Set<string>();
        for (const m of body.matchAll(/(?:const|let|var)\s+(\w+)/g))
            bodyLocals.add(m[1]);
        const usesModuleRef = [...refs].some(
            (n) =>
                !bodyLocals.has(n) &&
                new RegExp(`(?<![\\w.])${n}(?![\\w])`).test(body),
        );
        const usesNonSsrHelper = /(?<!\$)\$__(?!ssr)[A-Za-z_]/.test(body);
        const simple = classSimple && !usesModuleRef && !usesNonSsrHelper;
        out.push({ tag, cls, propSafe, simple, body });
    }
    return out;
};

const splitProps = (obj: string): Record<string, string> => {
    const inner = obj.slice(1, -1);
    const out: Record<string, string> = {};
    let i = 0;
    while (i < inner.length) {
        while (i < inner.length && /[\s,]/.test(inner[i])) i++;
        if (i >= inner.length) break;
        const colon = inner.indexOf(':', i);
        if (colon < 0) break;
        const key = inner.slice(i, colon).trim();
        let j = colon + 1;
        while (j < inner.length && /\s/.test(inner[j])) j++;
        const vstart = j;
        let depth = 0;
        let mode: 'code' | 'sq' | 'dq' | 'tmpl' = 'code';
        for (; j < inner.length; j++) {
            const c = inner[j];
            if (mode === 'sq') {
                if (c === '\\') j++;
                else if (c === "'") mode = 'code';
                continue;
            }
            if (mode === 'dq') {
                if (c === '\\') j++;
                else if (c === '"') mode = 'code';
                continue;
            }
            if (mode === 'tmpl') {
                if (c === '\\') j++;
                else if (c === '`') mode = 'code';
                continue;
            }
            if (c === "'") {
                mode = 'sq';
                continue;
            }
            if (c === '"') {
                mode = 'dq';
                continue;
            }
            if (c === '`') {
                mode = 'tmpl';
                continue;
            }
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') depth--;
            else if (c === ',' && depth === 0) break;
        }
        out[key] = inner.slice(vstart, j).trim();
        i = j + 1;
    }
    return out;
};

const topLevelArgs = (s: string, open: number, close: number): string[] => {
    const args: string[] = [];
    let start = open + 1;
    const stack: string[] = [];
    let mode: 'code' | 'sq' | 'dq' | 'tmpl' = 'code';
    for (let i = open + 1; i < close; i++) {
        const c = s[i];
        if (mode === 'sq') {
            if (c === '\\') i++;
            else if (c === "'") mode = 'code';
            continue;
        }
        if (mode === 'dq') {
            if (c === '\\') i++;
            else if (c === '"') mode = 'code';
            continue;
        }
        if (mode === 'tmpl') {
            if (c === '\\') i++;
            else if (c === '`') mode = 'code';
            else if (c === '$' && s[i + 1] === '{') {
                stack.push('${');
                mode = 'code';
                i++;
            }
            continue;
        }
        if (c === "'") mode = 'sq';
        else if (c === '"') mode = 'dq';
        else if (c === '`') mode = 'tmpl';
        else if (c === '(' || c === '[' || c === '{') stack.push(c);
        else if (c === ')' || c === ']' || c === '}') {
            if (stack.pop() === '${') mode = 'tmpl';
        } else if (c === ',' && stack.length === 0) {
            args.push(s.slice(start, i).trim());
            start = i + 1;
        }
    }
    args.push(s.slice(start, close).trim());
    return args;
};

const isEmptyArg = (arg: string | undefined): boolean =>
    arg === undefined ||
    arg === 'undefined' ||
    arg === 'null' ||
    arg === "''" ||
    arg === '""' ||
    arg === '``' ||
    arg === '[]' ||
    arg.trim() === '';

const parseSlotNames = (arg: string | undefined): string[] | null => {
    if (arg === undefined) return null;
    const m = arg.trim().match(/^\[([^\]]*)\]$/);
    if (m === null) return null;
    const inner = m[1].trim();
    if (inner === '') return [];
    const names: string[] = [];
    for (const part of inner.split(',')) {
        const pm = part.trim().match(/^(['"])([^'"]*)\1$/);
        if (pm === null) return null;
        names.push(pm[2]);
    }
    return names;
};

const inlineChild = (
    child: ChildMeta,
    props: Record<string, string>,
    rawProps: string,
    slot: string | undefined,
    attrs: string | undefined,
    slotNames: string[] | null,
): string | null => {
    let body = child.body;
    body = body.replaceAll(`\${this.$$__tag ?? '${child.tag}'}`, child.tag);
    body = body.replaceAll(`this.$$__tag ?? '${child.tag}'`, `'${child.tag}'`);
    body = body.replaceAll(`\${this.$$__tag}`, child.tag);
    body = body.replaceAll('this.$$__tag', `'${child.tag}'`);
    body = body.replace(
        /this\.hasSlot\(\s*(['"])([^'"]*)\1\s*\)/g,
        (_m, _q, name) => (slotNames?.includes(name) ? 'true' : 'false'),
    );
    let probe = body;
    for (const key of Object.keys(props))
        probe = probe.replace(new RegExp(`this\\.props\\.${key}\\b`, 'g'), '');
    if (/\bthis\.props\b/.test(probe) || /\bthis\.hasSlot\b/.test(probe))
        return null;
    for (const key of Object.keys(props).sort((a, b) => b.length - a.length))
        body = body.replace(
            new RegExp(`this\\.props\\.${key}\\b`, 'g'),
            () => props[key],
        );

    const attrPart = isEmptyArg(attrs) ? '' : `\${${attrs}}`;
    const dataPart =
        child.propSafe || rawProps.trim() === '{}'
            ? ''
            : `\${$__ssrData(${rawProps})}`;
    const inject = `${attrPart}${dataPart}`;
    const hasSlot = !isEmptyArg(slot);

    const parts = topLevelArgs(body, -1, body.length);

    if (inject !== '') {
        const first = parts[0];
        if (!first.startsWith('`') || !first.endsWith('`')) return null;
        const open = `<${child.tag}`;
        const at = first.indexOf(open);
        if (at < 0) return null;
        const insertAt = at + open.length;
        parts[0] = first.slice(0, insertAt) + inject + first.slice(insertAt);
    }

    if (!hasSlot) return `[${parts.join(', ')}]`;

    const close = `</${child.tag}>`;
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (!last.startsWith('`') || !last.endsWith('`')) return null;
    const inner = last.slice(1, -1);
    if (!inner.endsWith(close)) return null;
    parts[lastIdx] = `\`${inner.slice(0, -close.length)}\``;
    return `[${parts.join(', ')}, ${slot}, \`${close}\`]`;
};

const ensureImport = (src: string, helper: string): string => {
    if (!new RegExp(`\\${helper}\\b`).test(src)) return src;
    if (/from '@neuralfog\/elemix\/ssr-runtime'/.test(src)) {
        return src.replace(
            /import \{([^}]*)\} from '@neuralfog\/elemix\/ssr-runtime'/,
            (_m, names) => {
                const set = new Set(
                    names
                        .split(',')
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                );
                if (set.has(helper)) return _m;
                set.add(helper);
                return `import { ${[...set].join(', ')} } from '@neuralfog/elemix/ssr-runtime'`;
            },
        );
    }
    return `import { ${helper} } from '@neuralfog/elemix/ssr-runtime';\n${src}`;
};

const HTML_TEXT: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
};

const foldableConsts = (src: string): Map<string, string> => {
    const out = new Map<string, string>();
    const re =
        /^(?:export\s+)?const\s+(\w+)\s*=\s*('[^'\\\n]*'|"[^"\\\n]*"|`[^`\\]*`)\s*;/gm;
    for (const m of src.matchAll(re)) {
        const raw = m[2];
        const content = raw.slice(1, -1);
        if (raw[0] === '`' && content.includes('${')) continue;
        out.set(m[1], content);
    }
    return out;
};

const literalContent = (arg: string): string | null => {
    const t = arg.trim();
    if (t.length < 2) return null;
    const q = t[0];
    const end = t[t.length - 1];
    if ((q === "'" || q === '"') && end === q) {
        const inner = t.slice(1, -1);
        if (inner.includes('\\') || inner.includes(q) || inner.includes('\n'))
            return null;
        return inner;
    }
    if (q === '`' && end === '`') {
        const inner = t.slice(1, -1);
        if (inner.includes('\\') || inner.includes('${')) return null;
        return inner;
    }
    return null;
};

const unwrap = (s: string): string => {
    let t = s.trim();
    while (t.startsWith('(') && scanBalanced(t, 0) === t.length - 1)
        t = t.slice(1, -1).trim();
    return t;
};

const foldConstText = (src: string): string => {
    const consts = foldableConsts(src);
    const temps = new Map<string, string | null>();
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const re = /(?:const\s+(_t\d+)\s*=\s*\()|((?:\$__ssrText|\$__ssrLen)\()/g;
    const resolve = (raw: string): string | null => {
        const arg = unwrap(raw);
        const lit = literalContent(arg);
        if (lit !== null) return lit;
        if (consts.has(arg)) return consts.get(arg) as string;
        if (/^_t\d+$/.test(arg)) {
            const bound = temps.get(arg);
            if (bound != null) return bound;
        }
        return null;
    };
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
        const paren = m.index + m[0].length - 1;
        const close = scanBalanced(src, paren);
        if (close < 0) continue;
        if (m[1] !== undefined) {
            temps.set(m[1], resolve(src.slice(paren + 1, close).trim()));
            re.lastIndex = close + 1;
            continue;
        }
        const value = resolve(src.slice(paren + 1, close).trim());
        if (value === null) continue;
        const text = m[0].startsWith('$__ssrText')
            ? JSON.stringify(value.replace(/[&<>]/g, (c) => HTML_TEXT[c]))
            : String(value.length);
        edits.push({ start: m.index, end: close + 1, text });
        re.lastIndex = close + 1;
    }
    if (edits.length === 0) return src;
    let out = src;
    for (let i = edits.length - 1; i >= 0; i--)
        out =
            out.slice(0, edits[i].start) +
            edits[i].text +
            out.slice(edits[i].end);
    return out;
};

const dropDeadTemps = (src: string): string => {
    const consts = foldableConsts(src);
    const removals: Array<[number, number]> = [];
    const re = /const\s+(_t\d+)\s*=\s*\(/g;
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
        const paren = m.index + m[0].length - 1;
        const close = scanBalanced(src, paren);
        if (close < 0) continue;
        let end = close + 1;
        if (src[end] === ';') end++;
        const expr = unwrap(src.slice(paren + 1, close));
        const isConst = literalContent(expr) !== null || consts.has(expr);
        if (isConst) {
            const scopeEnd = scanBalanced(src, end);
            const region =
                scopeEnd < 0 ? src.slice(end) : src.slice(end, scopeEnd);
            if (!new RegExp(`\\b${m[1]}\\b`).test(region))
                removals.push([m.index, end]);
        }
        re.lastIndex = end;
    }
    if (removals.length === 0) return src;
    let out = src;
    for (let i = removals.length - 1; i >= 0; i--)
        out = out.slice(0, removals[i][0]) + out.slice(removals[i][1]);
    return out;
};

const SIMPLE_INIT = /^(?:[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?)$/;

const substInCode = (s: string, subst: Map<string, string>): string => {
    const apply = (code: string): string => {
        let r = code;
        for (const [n, v] of subst)
            r = r.replace(new RegExp(`\\b${n}\\b`, 'g'), v);
        return r;
    };
    let out = '';
    let code = '';
    let mode: 'code' | 'sq' | 'dq' | 'tmpl' = 'code';
    const stack: string[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (mode === 'code') {
            if (c === "'" || c === '"' || c === '`') {
                out += apply(code) + c;
                code = '';
                mode = c === "'" ? 'sq' : c === '"' ? 'dq' : 'tmpl';
            } else if (c === '(' || c === '[' || c === '{') {
                stack.push(c);
                code += c;
            } else if (c === ')' || c === ']' || c === '}') {
                if (stack.pop() === '${') {
                    out += apply(code) + c;
                    code = '';
                    mode = 'tmpl';
                } else code += c;
            } else code += c;
            continue;
        }
        if (mode === 'sq' || mode === 'dq') {
            out += c;
            if (c === '\\') out += s[++i] ?? '';
            else if (
                (mode === 'sq' && c === "'") ||
                (mode === 'dq' && c === '"')
            )
                mode = 'code';
            continue;
        }
        if (c === '\\') out += c + (s[++i] ?? '');
        else if (c === '`') {
            out += c;
            mode = 'code';
        } else if (c === '$' && s[i + 1] === '{') {
            out += '${';
            i++;
            stack.push('${');
            mode = 'code';
        } else out += c;
    }
    return out + apply(code);
};

const collapseIIFE = (src: string): string => {
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const re = /\(\(\)\s*=>\s*\{/g;
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
        const brace = m.index + m[0].length - 1;
        const braceClose = scanBalanced(src, brace);
        if (
            braceClose < 0 ||
            src.slice(braceClose + 1, braceClose + 4) !== ')()'
        )
            continue;
        const body = src.slice(brace + 1, braceClose);
        const subst = new Map<string, string>();
        let pos = 0;
        let ok = true;
        for (;;) {
            const d = /^\s*const\s+(_t\d+)\s*=\s*\(/.exec(body.slice(pos));
            if (!d) break;
            const paren = pos + d.index + d[0].length - 1;
            const close = scanBalanced(body, paren);
            if (close < 0) {
                ok = false;
                break;
            }
            const init = unwrap(body.slice(paren + 1, close));
            if (!SIMPLE_INIT.test(init)) {
                ok = false;
                break;
            }
            subst.set(d[1], init);
            pos = close + 1;
            if (body[pos] === ';') pos++;
        }
        const rest = body.slice(pos).trimStart();
        if (!ok || !/^return[\s`(]/.test(rest)) continue;
        let expr = rest.slice(6).trim();
        if (expr.endsWith(';')) expr = expr.slice(0, -1).trim();
        edits.push({
            start: m.index,
            end: braceClose + 4,
            text: subst.size > 0 ? substInCode(expr, subst) : expr,
        });
        re.lastIndex = braceClose + 4;
    }
    if (edits.length === 0) return src;
    let out = src;
    for (let i = edits.length - 1; i >= 0; i--)
        out =
            out.slice(0, edits[i].start) +
            edits[i].text +
            out.slice(edits[i].end);
    return out;
};

const stripSsrTpl = (src: string): string => {
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const re = /\$__ssrTpl\(/g;
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
        const paren = m.index + m[0].length - 1;
        const close = scanBalanced(src, paren);
        if (close < 0) continue;
        const args = topLevelArgs(src, paren, close);
        if (args.length === 1 && args[0] !== '') {
            edits.push({ start: m.index, end: close + 1, text: args[0] });
            re.lastIndex = close + 1;
        }
    }
    if (edits.length === 0) return src;
    let out = src;
    for (let i = edits.length - 1; i >= 0; i--)
        out =
            out.slice(0, edits[i].start) +
            edits[i].text +
            out.slice(edits[i].end);
    return out;
};

export const optimiserSource = (
    src: string,
    registry: Map<string, ChildMeta>,
): { code: string; inlined: number } => {
    let out = src;
    let inlined = 0;
    let cursor = 0;
    for (;;) {
        const rel = out.slice(cursor).search(/\$__ssrChild\('[^']+',/);
        if (rel < 0) break;
        const callStart = cursor + rel;
        const paren = out.indexOf('(', callStart);
        const callEnd = scanBalanced(out, paren);
        if (callEnd < 0) {
            cursor = callStart + 12;
            continue;
        }
        const args = topLevelArgs(out, paren, callEnd);
        const tag = args[0]?.match(/^'([^']+)'$/)?.[1];
        const child = tag ? registry.get(tag) : undefined;
        const slotNames = args.length >= 5 ? parseSlotNames(args[4]) : null;
        if (
            !child?.simple ||
            args.length < 2 ||
            args.length > 5 ||
            (args.length >= 5 && slotNames === null)
        ) {
            cursor = callStart + 12;
            continue;
        }
        const replacement = inlineChild(
            child,
            splitProps(args[1]),
            args[1],
            args[2],
            args[3],
            slotNames,
        );
        if (replacement === null) {
            cursor = callStart + 12;
            continue;
        }
        out = out.slice(0, callStart) + replacement + out.slice(callEnd + 1);
        inlined++;
        cursor = callStart;
    }
    out = dropDeadTemps(foldConstText(out));
    for (let prev = ''; prev !== out; ) {
        prev = out;
        out = collapseIIFE(out);
    }
    out = stripSsrTpl(out);
    if (inlined > 0) {
        const helpers = new Set<string>();
        for (const m of out.matchAll(/(?<!\$)\$__ssr\w+/g)) helpers.add(m[0]);
        for (const helper of helpers) out = ensureImport(out, helper);
    }
    return { code: out, inlined };
};
