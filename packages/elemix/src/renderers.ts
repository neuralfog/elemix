import type { Renderer } from './component/Renderer';
import type { Component } from './component/Component';

export const activeRenderers = new Set<Renderer>();

/**
 * Tracks which component is currently executing template() so that
 * Reactive proxies can auto-subscribe the component when its template
 * reads a signal value.
 *
 * Held inside an object so cross-module mutation is observable.
 */
export const renderTracking: {
    active: Component | null;
    rowReads: (object | number)[] | null;
} = { active: null, rowReads: null };

const versions = new WeakMap<object, number>();

export const versionOf = (obj: object): number => versions.get(obj) ?? 0;

export const bumpVersion = (obj: object): void =>
    void versions.set(obj, (versions.get(obj) ?? 0) + 1);

/**
 * A single list row as an independent reactive scope. Holds the objects it
 * read (deps) and a `rerun` that re-evaluates just that row and patches its
 * fragment — no component re-render, no list walk.
 */
export type RowScope = {
    deps: (object | number)[];
    rerun(): void;
};

const rowSubs = new WeakMap<object, Set<RowScope>>();

export const subscribeRow = (scope: RowScope): void => {
    const { deps } = scope;
    for (let i = 0; i < deps.length; i += 2) {
        const obj = deps[i] as object;
        let set = rowSubs.get(obj);
        if (!set) rowSubs.set(obj, (set = new Set()));
        set.add(scope);
    }
};

export const unsubscribeRow = (scope: RowScope): void => {
    const { deps } = scope;
    for (let i = 0; i < deps.length; i += 2) {
        rowSubs.get(deps[i] as object)?.delete(scope);
    }
};

export const notifyRows = (target: object): void => {
    const set = rowSubs.get(target);
    if (!set || set.size === 0) return;
    for (const scope of [...set]) scope.rerun();
};
