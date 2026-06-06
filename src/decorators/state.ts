type Component = any;

export const state =
    () =>
    (component: Component, propertyName: string): void => {
        if (!component.stateProperties) {
            component.stateProperties = new Set<string>();
        }

        component.stateProperties.add(propertyName);
    };
