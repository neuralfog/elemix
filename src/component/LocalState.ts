import { Reactive } from '../Reactive';
import type { Component } from './Component';

export class LocalState {
    constructor(private component: Component) {}

    public initialize(): void {
        const stateProperties = this.component.constructor.prototype
            .stateProperties as Set<string>;

        if (stateProperties)
            for (const propertyName of stateProperties) {
                const context = this.component as any;
                context[propertyName] = new Reactive<unknown>(
                    context[propertyName],
                ).subscribe(this.component).value;
            }
    }
}
