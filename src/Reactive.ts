import type { Component } from './component/Component';
import type { RenderTriggerType } from './types';

export class Reactive<State> {
    public subscribers = new Set<Component>();
    private proxy: State;
    private proxySet = new WeakSet<any>();

    public get value(): State {
        return this.proxy;
    }

    constructor(
        state: any,
        private renderTrigger?: RenderTriggerType,
    ) {
        this.proxy = this.create(state);
    }

    public subscribe(instance: Component): Reactive<State> {
        if (!this.subscribers.has(instance)) this.subscribers.add(instance);
        return this;
    }

    public unsubscribe(instance: Component): Reactive<State> {
        this.subscribers.delete(instance);
        return this;
    }

    private create(state: any): State {
        const reactive = this;

        return new Proxy(state, {
            get(target, name): unknown {
                const prop = target[name];

                unsupportedCollectionError(prop);

                if (
                    typeof prop === 'object' &&
                    prop !== null &&
                    !reactive.proxySet.has(prop)
                ) {
                    const propRef = new Proxy(prop, this);
                    reactive.proxySet.add(propRef);
                    return propRef;
                }

                return prop;
            },
            set(target, name, value): boolean {
                target[name] = value;

                unsupportedCollectionError(target);

                if (Array.isArray(target) && name === 'length') {
                    reactive.notify();
                    return true;
                }

                reactive.notify();
                return true;
            },
        }) as State;
    }

    private notify(): void {
        for (const subscriber of this.subscribers) {
            subscriber.render(this.renderTrigger);
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
