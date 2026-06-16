export type Dep = {
    subs: Scope | Scope[] | null;
    subSlots: number | number[];
};

export type Scope = {
    deps: Dep[];
    depSlots: number[];
    fn: () => void;
    next: Scope | null;
};

export const dep = (): Dep => ({ subs: null, subSlots: 0 });

let activeScope: Scope | null = null;
let sink: Scope | null = null;
let collecting = false;
let lastScopes: Scope | null = null;

const cleanSources = (scope: Scope): void => {
    const deps = scope.deps;
    const depSlots = scope.depSlots;
    while (deps.length) {
        const d = deps.pop() as Dep;
        const slot = depSlots.pop() as number;
        const subs = d.subs;
        if (Array.isArray(subs)) {
            const slots = d.subSlots as number[];
            const last = subs.pop() as Scope;
            const lastSlot = slots.pop() as number;
            if (slot < subs.length) {
                subs[slot] = last;
                slots[slot] = lastSlot;
                last.depSlots[lastSlot] = slot;
            }
        } else {
            d.subs = null;
        }
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

export const untrack = <T>(fn: () => T): T => {
    const prev = activeScope;
    activeScope = null;
    try {
        return fn();
    } finally {
        activeScope = prev;
    }
};

export const track = (d: Dep): void => {
    const scope = activeScope;
    if (scope === null) return;
    const subs = d.subs;
    if (subs === scope) return;
    if (Array.isArray(subs)) {
        if (subs[subs.length - 1] === scope) return;
        scope.deps.push(d);
        scope.depSlots.push(subs.length);
        (d.subSlots as number[]).push(scope.deps.length - 1);
        subs.push(scope);
    } else if (subs === null) {
        scope.deps.push(d);
        scope.depSlots.push(0);
        d.subs = scope;
        d.subSlots = scope.deps.length - 1;
    } else {
        scope.deps.push(d);
        scope.depSlots.push(1);
        d.subs = [subs, scope];
        d.subSlots = [d.subSlots as number, scope.deps.length - 1];
    }
};

export const trigger = (d: Dep): void => {
    const subs = d.subs;
    if (subs === null) return;
    if (Array.isArray(subs)) {
        const copy = subs.slice();
        for (let i = 0; i < copy.length; i++) runScope(copy[i]);
    } else {
        runScope(subs);
    }
};

export const effect = (fn: () => void): void => {
    const scope: Scope = { deps: [], depSlots: [], fn, next: null };
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
        const d = dep();
        Object.defineProperty(store, key, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                track(d);
                return value;
            },
            set(next: unknown): void {
                if (value === next) return;
                value = next;
                trigger(d);
            },
        });
    }
    return source;
};
