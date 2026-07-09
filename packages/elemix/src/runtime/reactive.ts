export type Dep = {
    subs: Scope | Scope[] | null;
    subSlots: number | number[];
};

export type Scope = {
    deps: Dep | Dep[] | null;
    depSlots: number | number[];
    fn: () => void;
    next: Scope | null;
};

export const $__dep = (): Dep => ({ subs: null, subSlots: 0 });

let activeScope: Scope | null = null;
let sink: Scope | null = null;
let collecting = false;
let lastScopes: Scope | null = null;

const removeSub = (d: Dep, slot: number): void => {
    const subs = d.subs;
    if (Array.isArray(subs)) {
        const slots = d.subSlots as number[];
        const last = subs.pop() as Scope;
        const lastSlot = slots.pop() as number;
        if (slot < subs.length) {
            subs[slot] = last;
            slots[slot] = lastSlot;
            if (Array.isArray(last.depSlots)) {
                last.depSlots[lastSlot] = slot;
            } else {
                last.depSlots = slot;
            }
        }
    } else {
        d.subs = null;
    }
};

const cleanSources = (scope: Scope): void => {
    const deps = scope.deps;
    if (deps === null) return;
    if (Array.isArray(deps)) {
        const depSlots = scope.depSlots as number[];
        for (let k = 0; k < deps.length; k++) removeSub(deps[k], depSlots[k]);
        deps.length = 0;
        depSlots.length = 0;
    } else {
        removeSub(deps, scope.depSlots as number);
        scope.deps = null;
        scope.depSlots = 0;
    }
};

const runScope = (scope: Scope): void => {
    cleanSources(scope);
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
        cleanSources(scope);
        const next = scope.next;
        scope.next = null;
        scope = next;
    }
};

export const $__untrack = <T>(fn: () => T): T => {
    const prev = activeScope;
    activeScope = null;
    try {
        return fn();
    } finally {
        activeScope = prev;
    }
};

const addDep = (scope: Scope, d: Dep): number => {
    const deps = scope.deps;
    if (deps === null) {
        scope.deps = d;
        return 0;
    }
    if (Array.isArray(deps)) {
        deps.push(d);
        (scope.depSlots as number[]).push(0);
        return deps.length - 1;
    }
    scope.deps = [deps, d];
    scope.depSlots = [scope.depSlots as number, 0];
    return 1;
};

const setDepSlot = (scope: Scope, sslot: number, dslot: number): void => {
    if (Array.isArray(scope.depSlots)) {
        scope.depSlots[sslot] = dslot;
    } else {
        scope.depSlots = dslot;
    }
};

export const $__track = (d: Dep): void => {
    const scope = activeScope;
    if (scope === null) return;
    const subs = d.subs;
    if (subs === scope) return;
    if (Array.isArray(subs)) {
        if (subs[subs.length - 1] === scope) return;
        const sslot = addDep(scope, d);
        setDepSlot(scope, sslot, subs.length);
        (d.subSlots as number[]).push(sslot);
        subs.push(scope);
    } else if (subs === null) {
        const sslot = addDep(scope, d);
        setDepSlot(scope, sslot, 0);
        d.subs = scope;
        d.subSlots = sslot;
    } else {
        const sslot = addDep(scope, d);
        setDepSlot(scope, sslot, 1);
        d.subs = [subs, scope];
        d.subSlots = [d.subSlots as number, sslot];
    }
};

export const $__trigger = (d: Dep): void => {
    const subs = d.subs;
    if (subs === null) return;
    if (Array.isArray(subs)) {
        const copy = subs.slice();
        for (let i = 0; i < copy.length; i++) {
            if (copy[i] !== activeScope) runScope(copy[i]);
        }
    } else if (subs !== activeScope) {
        runScope(subs);
    }
};

export const $__effect = (fn: () => void): void => {
    const scope: Scope = { deps: null, depSlots: 0, fn, next: null };
    if (collecting) {
        scope.next = sink;
        sink = scope;
    }
    runScope(scope);
};

export const $__bind = (fn: () => void, sources: Dep[]): void => {
    $__effect(() => {
        for (let i = 0; i < sources.length; i++) $__track(sources[i]);
        fn();
    });
};

export const $__reactive = <T extends object>(source: T): T => {
    const store = source as Record<string, unknown>;
    for (const key of Object.keys(store)) {
        let value = store[key];
        const d = $__dep();
        Object.defineProperty(store, key, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                $__track(d);
                return value;
            },
            set(next: unknown): void {
                if (value === next) return;
                value = next;
                $__trigger(d);
            },
        });
    }
    return source;
};
