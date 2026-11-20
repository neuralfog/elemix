import { type Scope, $__activeScope, $__track, $__trigger } from './reactive';

export class Silo<T> {
    subs: Scope | Scope[] | null = null;
    subSlots: number | number[] = 0;
    #value: T;

    constructor(value: T) {
        this.#value = value;
    }

    get value(): T {
        if ($__activeScope !== null) $__track(this);
        return this.#value;
    }

    set value(next: T) {
        if (this.#value === next) return;
        this.#value = next;
        $__trigger(this);
    }

    trigger(): void {
        $__trigger(this);
    }
}

export const silo = <T>(value: T): Silo<T> => new Silo(value);
