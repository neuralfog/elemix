import type { DiContainer } from './DiContainer';
import type { TokenLike } from './Token';

export type Factory<T> = (c: DiContainer) => T;

export type Provider<T> = () => T;

export type Disposable = {
    dispose(): void | Promise<void>;
};

export type BuildableLifetime = 'singleton' | 'scoped' | 'transient';

export enum DiServiceType {
    Singleton = 'singleton',
    Scoped = 'scoped',
    Transient = 'transient',
}

export type DiService = {
    service: DiServiceType;
};

export type ServiceClass = (new (
    ...args: never[]
) => object) &
    Partial<DiService>;

export type FactoryService = {
    provide: TokenLike<unknown>;
    factory: Factory<unknown>;
};

export type ValueService = {
    provide: TokenLike<unknown>;
    value: unknown;
};

export type Service = ServiceClass | FactoryService | ValueService;
