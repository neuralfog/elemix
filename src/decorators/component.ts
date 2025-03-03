import type { Reactive } from '../Reactive';

type ComponentDecoratorConfig = {
    tag: string;
    signals?: Reactive<unknown>[];
    styles?: string[];
};

type Component = any;

const define = (tag: string, component: Component): void => {
    if (customElements.get(tag) === undefined) {
        customElements.define(tag, component);
    }
};

export const component =
    ({ tag, signals, styles }: ComponentDecoratorConfig) =>
    (component: Component): void => {
        const extendedClass = class extends component {
            constructor() {
                super();

                if (signals?.length) {
                    for (const signal of signals) {
                        signal.subscribe(this as any);
                    }
                }
            }
        };

        component.$signals = signals || [];
        component.$styles = styles || [];
        define(tag, extendedClass);
    };
