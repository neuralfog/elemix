import type { Reactive } from '../Reactive';
import { camelToKebabCase } from '../utilities';

type ComponentDecoratorConfig = {
    tag?: string;
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
    (config?: ComponentDecoratorConfig) =>
    (component: Component): void => {
        const componentTag = config?.tag || camelToKebabCase(component.name);

        const extendedClass = class extends component {
            constructor() {
                super();

                if (config?.signals?.length) {
                    for (const signal of config.signals) {
                        signal.subscribe(this as any);
                    }
                }
            }
        };

        component.$signals = config?.signals || [];
        component.$styles = config?.styles || [];
        define(componentTag, extendedClass);
    };
