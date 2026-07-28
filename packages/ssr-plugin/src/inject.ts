import { parse } from '@babel/parser';
import type {
    ClassDeclaration,
    ClassExpression,
    ClassMethod,
    Identifier,
    Node,
} from '@babel/types';
import MagicString from 'magic-string';

const INJECT_KEY = 'Symbol.for("ssr.inject")';
const INJECT_METHODS_KEY = 'Symbol.for("ssr.inject.methods")';

type ClassNode = ClassDeclaration | ClassExpression;

export interface InjectResult {
    code: string;
    map: ReturnType<MagicString['generateMap']>;
}

const isClass = (node: Node): node is ClassNode =>
    node.type === 'ClassDeclaration' || node.type === 'ClassExpression';

function* walk(node: unknown): Generator<Node> {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const child of node) yield* walk(child);
        return;
    }
    const candidate = node as Node;
    if (typeof candidate.type === 'string') yield candidate;
    for (const [key, value] of Object.entries(node)) {
        if (key === 'type' || key === 'loc') continue;
        if (value !== null && typeof value === 'object') yield* walk(value);
    }
}

const referenceName = (id: Identifier): string | null => {
    const annotation = id.typeAnnotation;
    if (annotation?.type !== 'TSTypeAnnotation') return null;
    const type = annotation.typeAnnotation;
    if (type.type !== 'TSTypeReference') return null;
    if (type.typeName.type !== 'Identifier') return null;
    return type.typeName.name;
};

const collectTypeOnly = (program: Node): Set<string> => {
    const names = new Set<string>();
    for (const node of walk(program)) {
        if (node.type === 'ImportDeclaration') {
            const allType = node.importKind === 'type';
            for (const spec of node.specifiers) {
                if (
                    spec.type === 'ImportSpecifier' &&
                    (allType || spec.importKind === 'type')
                ) {
                    names.add(spec.local.name);
                }
            }
        } else if (
            node.type === 'TSInterfaceDeclaration' ||
            node.type === 'TSTypeAliasDeclaration'
        ) {
            names.add(node.id.name);
        }
    }
    return names;
};

const paramTokens = (
    params: ClassMethod['params'],
    typeOnly: Set<string>,
): string[] | null => {
    const tokens: string[] = [];
    for (const param of params) {
        const id =
            param.type === 'TSParameterProperty' ? param.parameter : param;
        if (id.type !== 'Identifier') return null;
        const name = referenceName(id);
        if (name === null || typeOnly.has(name)) return null;
        tokens.push(name);
    }
    return tokens;
};

const constructorTokens = (
    node: ClassNode,
    typeOnly: Set<string>,
): string[] | null => {
    const ctor = node.body.body.find(
        (member): member is ClassMethod =>
            member.type === 'ClassMethod' && member.kind === 'constructor',
    );
    if (!ctor || ctor.params.length === 0) return null;
    return paramTokens(ctor.params, typeOnly);
};

const methodTokens = (
    node: ClassNode,
    typeOnly: Set<string>,
): Record<string, string[]> | null => {
    const methods: Record<string, string[]> = {};
    for (const member of node.body.body) {
        if (member.type !== 'ClassMethod') continue;
        if (member.kind !== 'method') continue;
        if (member.key.type !== 'Identifier') continue;
        if (member.params.length === 0) continue;
        const tokens = paramTokens(member.params, typeOnly);
        if (tokens !== null) methods[member.key.name] = tokens;
    }
    return Object.keys(methods).length > 0 ? methods : null;
};

export const injectMetadata = (
    code: string,
    id: string,
): InjectResult | null => {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });

    const typeOnly = collectTypeOnly(ast.program);
    const s = new MagicString(code);
    let changed = false;
    for (const node of walk(ast.program)) {
        if (!isClass(node)) continue;
        const ctorTokens = constructorTokens(node, typeOnly);
        const methods = methodTokens(node, typeOnly);
        if (ctorTokens === null && methods === null) continue;

        let statics = '';
        if (ctorTokens !== null) {
            statics += `\n    static [${INJECT_KEY}] = [${ctorTokens.join(', ')}];`;
        }
        if (methods !== null) {
            const entries = Object.entries(methods)
                .map(([name, toks]) => `${name}: [${toks.join(', ')}]`)
                .join(', ');
            statics += `\n    static [${INJECT_METHODS_KEY}] = { ${entries} };`;
        }
        s.appendLeft((node.body.start ?? 0) + 1, statics);
        changed = true;
    }

    if (!changed) return null;
    return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
    };
};

const ROUTE_CALL =
    /\bRoute\s*\.\s*(get|head|post|put|patch|delete|connect|options|trace|group)\b/;

export const stampRouteFile = (code: string, name: string): string => {
    if (!ROUTE_CALL.test(code)) return code;
    let ast: ReturnType<typeof parse>;
    try {
        ast = parse(code, { sourceType: 'module', plugins: ['typescript'] });
    } catch {
        return code;
    }
    let pos = 0;
    for (const node of ast.program.body) {
        if (node.type === 'ImportDeclaration' && typeof node.end === 'number') {
            pos = node.end;
        }
    }
    const s = new MagicString(code);
    s.appendRight(pos, `\nRoute.__file(${JSON.stringify(name)});`);
    return s.toString();
};
