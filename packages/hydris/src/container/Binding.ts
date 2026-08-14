import type { BuildableLifetime } from './types';

export type Binding = {
    singleton(): void;
    scoped(): void;
    transient(): void;
};

export const binding = (
    set: (lifetime: BuildableLifetime) => void,
): Binding => ({
    singleton: () => set('singleton'),
    scoped: () => set('scoped'),
    transient: () => set('transient'),
});
