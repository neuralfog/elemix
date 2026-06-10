import type { Component } from './component/Component';
import {
    renderTracking,
    bumpVersion,
    versionOf,
    notifyRows,
} from './renderers';

const observed = new WeakSet<object>();
const ARRAY_MUTATORS = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
] as const;

export class Reactive<State> {
    public subscribers = new Set<Component>();
    private root: State;

    public get value(): State {
        return this.root;
    }

    constructor(state: any) {
        this.root = this.observe(state) as State;
    }

    public subscribe(instance: Component): Reactive<State> {
        if (!this.subscribers.has(instance)) this.subscribers.add(instance);
        return this;
    }

    public unsubscribe(instance: Component): Reactive<State> {
        this.subscribers.delete(instance);
        return this;
    }

    private track(target: object, rawProp: unknown): void {
        if (renderTracking.rowReads) {
            renderTracking.rowReads.push(target, versionOf(target));
            if (typeof rawProp === 'object' && rawProp !== null) {
                renderTracking.rowReads.push(rawProp, versionOf(rawProp));
            }
        } else {
            const reader = renderTracking.active;
            if (reader) {
                this.subscribers.add(reader);
                reader.tracked.add(this);
                reader.deps.set(target, versionOf(target));
                if (Array.isArray(rawProp)) {
                    reader.deps.set(rawProp, versionOf(rawProp));
                }
            }
        }
    }

    private fire(target: object): void {
        bumpVersion(target);
        notifyRows(target);
        this.notify();
    }

    private observe(val: any): any {
        if (val === null || typeof val !== 'object') return val;
        if (
            val instanceof Map ||
            val instanceof Set ||
            val instanceof WeakMap ||
            val instanceof WeakSet
        ) {
            return val;
        }
        if (observed.has(val)) return val;
        observed.add(val);

        if (Array.isArray(val)) {
            this.observeArray(val);
        } else {
            for (const key of Object.keys(val)) this.defineReactive(val, key);
        }
        return val;
    }

    private defineReactive(obj: any, key: string): void {
        let raw = obj[key];
        let value = this.observe(raw);
        const self = this;
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                unsupportedCollectionError(value);
                self.track(obj, raw);
                return value;
            },
            set(next: unknown): void {
                raw = next;
                value = self.observe(next);
                self.fire(obj);
            },
        });
    }

    private observeArray(arr: any[]): void {
        const store = arr.slice();
        for (let i = 0; i < store.length; i++) {
            store[i] = this.observe(store[i]);
            this.defineIndex(arr, store, i);
        }
        this.patchMutators(arr, store);
    }

    private defineIndex(arr: any[], store: any[], index: number): void {
        const self = this;
        Object.defineProperty(arr, index, {
            enumerable: true,
            configurable: true,
            get(): unknown {
                self.track(arr, store[index]);
                return store[index];
            },
            set(next: unknown): void {
                store[index] = self.observe(next);
                self.fire(arr);
            },
        });
    }

    private syncIndices(arr: any[], store: any[], oldLen: number): void {
        const newLen = store.length;
        for (let i = oldLen; i < newLen; i++) this.defineIndex(arr, store, i);
        if (newLen < oldLen) {
            for (let i = newLen; i < oldLen; i++) delete arr[i];
            arr.length = newLen;
        }
    }

    private reconcile(arr: any[], store: any[]): void {
        const len = arr.length;
        if (len === store.length) return;
        if (len < store.length) {
            store.length = len;
        } else {
            for (let i = store.length; i < len; i++) {
                store[i] = this.observe(arr[i]);
                this.defineIndex(arr, store, i);
            }
        }
    }

    private patchMutators(arr: any[], store: any[]): void {
        const self = this;
        for (const name of ARRAY_MUTATORS) {
            Object.defineProperty(arr, name, {
                enumerable: false,
                configurable: true,
                writable: true,
                value(...args: any[]): unknown {
                    self.reconcile(arr, store);
                    const oldLen = store.length;
                    const items =
                        name === 'push' || name === 'unshift'
                            ? args.map((a) => self.observe(a))
                            : name === 'splice'
                              ? args.map((a, i) =>
                                    i >= 2 ? self.observe(a) : a,
                                )
                              : args;
                    const result = (Array.prototype[name] as any).apply(
                        store,
                        items,
                    );
                    self.syncIndices(arr, store, oldLen);
                    self.fire(arr);
                    return result;
                },
            });
        }
    }

    private notify(): void {
        for (const subscriber of this.subscribers) {
            if (subscriber.isDirty()) subscriber.render();
        }
    }
}

export const UNSUPPORTED_COLLECTION_ERROR_MESSAGE =
    'Reactive state does not support collections: Map, WeakMap, Set, WeakSet';

const unsupportedCollectionError = (prop: any): any => {
    if (
        prop instanceof Map ||
        prop instanceof WeakMap ||
        prop instanceof Set ||
        prop instanceof WeakSet
    ) {
        throw new Error(UNSUPPORTED_COLLECTION_ERROR_MESSAGE);
    }
};
