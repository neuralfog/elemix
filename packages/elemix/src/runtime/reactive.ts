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

const noop = (): void => {};

export const $__dep = (): Dep => ({ subs: null, subSlots: 0 });

export let $__activeScope: Scope | null = null;
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
        const slot = scope.depSlots as number;
        const subs = deps.subs;
        if (Array.isArray(subs)) {
            const slots = deps.subSlots as number[];
            const last = subs.pop() as Scope;
            const lastSlot = slots.pop() as number;
            if (slot < subs.length) {
                subs[slot] = last;
                slots[slot] = lastSlot;
                if (Array.isArray(last.depSlots))
                    last.depSlots[lastSlot] = slot;
                else last.depSlots = slot;
            }
        } else {
            deps.subs = null;
        }
        scope.deps = null;
        scope.depSlots = 0;
    }
};

const runScope = (scope: Scope): void => {
    cleanSources(scope);
    const prev = $__activeScope;
    $__activeScope = scope;
    try {
        scope.fn();
    } finally {
        $__activeScope = prev;
    }
};

export const rerun = (scope: Scope): void => runScope(scope);

export const collect = <T, A = unknown, B = unknown>(
    fn: (a: A, b: B) => T,
    a?: A,
    b?: B,
): T => {
    const prevSink = sink;
    const prevCollecting = collecting;
    sink = null;
    collecting = true;
    try {
        return fn(a as A, b as B);
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
        scope.fn = noop;
        const next = scope.next;
        scope.next = null;
        scope = next;
    }
};

export const $__untrack = <T>(fn: () => T): T => {
    const prev = $__activeScope;
    $__activeScope = null;
    try {
        return fn();
    } finally {
        $__activeScope = prev;
    }
};

export const $__track = (d: Dep): void => {
    const scope = $__activeScope;
    if (scope === null) return;
    const subs = d.subs;
    if (subs === scope) return;
    const subsList = Array.isArray(subs) ? subs : null;
    if (subsList && subsList[subsList.length - 1] === scope) return;

    const dslot = subs === null ? 0 : subsList ? subsList.length : 1;

    const deps = scope.deps;
    let sslot: number;
    if (deps === null) {
        scope.deps = d;
        scope.depSlots = dslot;
        sslot = 0;
    } else if (Array.isArray(deps)) {
        deps.push(d);
        (scope.depSlots as number[]).push(dslot);
        sslot = deps.length - 1;
    } else {
        scope.deps = [deps, d];
        scope.depSlots = [scope.depSlots as number, dslot];
        sslot = 1;
    }

    if (subs === null) {
        d.subs = scope;
        d.subSlots = sslot;
    } else if (subsList) {
        subsList.push(scope);
        (d.subSlots as number[]).push(sslot);
    } else {
        d.subs = [subs as Scope, scope];
        d.subSlots = [d.subSlots as number, sslot];
    }
};

export const $__trigger = (d: Dep): void => {
    const subs = d.subs;
    if (subs === null) return;
    if (Array.isArray(subs)) {
        const copy = subs.slice();
        for (let i = 0; i < copy.length; i++) {
            if (copy[i] !== $__activeScope) runScope(copy[i]);
        }
    } else if (subs !== $__activeScope) {
        runScope(subs);
    }
};

export const $__effect = (fn: () => void): void => {
    const scope: Scope = { deps: null, depSlots: 0, fn, next: null };
    if (collecting) {
        scope.next = sink;
        sink = scope;
    }
    const prev = $__activeScope;
    $__activeScope = scope;
    try {
        fn();
    } finally {
        $__activeScope = prev;
    }
};

export const $__rootEffect = (fn: () => void): void => {
    const prev = collecting;
    collecting = false;
    try {
        $__effect(fn);
    } finally {
        collecting = prev;
    }
};

export const $__bind = (fn: () => void, sources: Dep[]): void => {
    $__effect(() => {
        for (let i = 0; i < sources.length; i++) $__track(sources[i]);
        fn();
    });
};
