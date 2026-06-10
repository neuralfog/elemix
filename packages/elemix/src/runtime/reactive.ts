export type Scope = {
    deps: Set<Set<Scope>>;
    rerun(): void;
};

let activeScope: Scope | null = null;
let currentSink: Set<Scope> | null = null;

export const collect = <T>(sink: Set<Scope>, fn: () => T): T => {
    const prev = currentSink;
    currentSink = sink;
    try {
        return fn();
    } finally {
        currentSink = prev;
    }
};

export const dispose = (scope: Scope): void => {
    for (const subs of scope.deps) subs.delete(scope);
    scope.deps.clear();
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
    for (const scope of [...subs]) scope.rerun();
};

export const effect = (fn: () => void): void => {
    const scope: Scope = {
        deps: new Set(),
        rerun: () => run(),
    };
    if (currentSink) currentSink.add(scope);
    const run = (): void => {
        for (const subs of scope.deps) subs.delete(scope);
        scope.deps.clear();
        const prev = activeScope;
        activeScope = scope;
        try {
            fn();
        } finally {
            activeScope = prev;
        }
    };
    run();
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
