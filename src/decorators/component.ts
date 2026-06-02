import { camelToKebabCase } from '../utilities';

type ComponentDecoratorConfig = {
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
        const componentTag = camelToKebabCase(component.name);
        component.$styles = config?.styles || [];
        define(componentTag, component);
    };
