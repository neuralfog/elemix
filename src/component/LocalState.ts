import { Reactive } from '../Reactive';
import type { Component } from './Component';

export class LocalState {
    constructor(private component: Component) {}

    public initialize(): void {
        const stateProperties = this.component.constructor.prototype
            .stateProperties as Map<string, string>;

        if (stateProperties)
            for (const [propertyName, renderTrigger] of stateProperties) {
                const context = this.component as any;
                context[propertyName] = new Reactive<unknown>(
                    context[propertyName],
                    renderTrigger,
                ).subscribe(this.component).value;
            }
    }
}
