import { RenderTrigger, type RenderTriggerType } from '../types';

type Component = any;

export const state =
    (renderTrigger?: string) =>
    (component: Component, propertyName: string): void => {
        if (!component.stateProperties) {
            component.stateProperties = new Map<
                string,
                string | RenderTriggerType
            >();
        }

        if (!component.stateProperties.has(propertyName))
            component.stateProperties.set(
                propertyName,
                renderTrigger || RenderTrigger.LOCAL_STATE,
            );
    };
