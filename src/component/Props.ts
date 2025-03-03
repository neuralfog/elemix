import { Reactive } from '../Reactive';
import { RenderTrigger } from '../types';
import type { Component } from './Component';

export class Props<ComponentProps = unknown> {
    public data = {} as ComponentProps;

    constructor(private component: Component) {}

    public initialize(): void {
        this.data = new Reactive<ComponentProps>(
            this.data,
            RenderTrigger.PROPS,
        ).subscribe(this.component).value;
    }

    public setReactive(name: string, value: unknown): void {
        (this.data as any)[name] = value;
    }

    public set(name: string, value: unknown): void {
        if (typeof value === 'object' && value !== null) {
            this.setReactive(name, value);
            return;
        }

        const prop = (this.data as any)[name];

        if (typeof value === 'function') {
            if (!(this.data as any)[name]) {
                this.setReactive(name, value);
            }
            return;
        }

        if (prop !== value) {
            this.setReactive(name, value);
        }
    }
}
