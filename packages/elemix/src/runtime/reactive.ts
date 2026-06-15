export type Scope = {
    deps: Set<Set<Scope>>;
    fn: () => void;
    next: Scope | null;
};

let activeScope: Scope | null = null;
let sink: Scope | null = null;
let collecting = false;
let lastScopes: Scope | null = null;

const runScope = (scope: Scope): void => {
    for (const subs of scope.deps) subs.delete(scope);
    scope.deps.clear();
    const prev = activeScope;
    activeScope = scope;
    try {
        scope.fn();
    } finally {
        activeScope = prev;
    }
};

export const rerun = (scope: Scope): void => runScope(scope);

export const collect = <T>(fn: () => T): T => {
    const prevSink = sink;
    const prevCollecting = collecting;
    sink = null;
    collecting = true;
    try {
        return fn();
    } finally {
        lastScopes = sink;
        sink = prevSink;
        collecting = prevCollecting;
    }
};

export const takeScopes = (): Scope | null => {
    const s = lastScopes;
    lastScopes = null;
    return s;
};

export const dispose = (head: Scope | null): void => {
    let scope = head;
    while (scope) {
        for (const subs of scope.deps) subs.delete(scope);
        scope.deps.clear();
        const next = scope.next;
        scope.next = null;
        scope = next;
    }
};

export const untrack = <T>(fn: () => T): T => {
    const prev = activeScope;
    activeScope = null;
    try {
        return fn();
    } finally {
        activeScope = prev;
    }
};

export const track = (subs: Set<Scope>): void => {
    if (activeScope) {
        subs.add(activeScope);
        activeScope.deps.add(subs);
    }
};

export const trigger = (subs: Set<Scope>): void => {
    for (const scope of [...subs]) runScope(scope);
};

export const effect = (fn: () => void): void => {
    const scope: Scope = { deps: new Set(), fn, next: null };
    if (collecting) {
        scope.next = sink;
        sink = scope;
    }
    runScope(scope);
};

export const reactive = <T extends object>(source: T): T => {
    const store = source as Record<string, unknown>;
    for (const key of Object.keys(store)) {
        let value = store[key];
        const subs = new Set<Scope>();
        Object.defineProperty(store, key, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                track(subs);
                return value;
            },
            set(next: unknown): void {
                if (value === next) return;
                value = next;
                trigger(subs);
            },
        });
    }
    return source;
};
