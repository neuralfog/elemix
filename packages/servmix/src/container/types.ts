import type { DiContainer } from './DiContainer';
import type { TokenLike } from './Token';

export type Factory<T> = (c: DiContainer) => T;

export type Provider<T> = () => T;

export type Lifetime = 'singleton' | 'scoped' | 'transient' | 'value';

export interface Disposable {
    dispose(): void | Promise<void>;
}

export type BuildableLifetime = 'singleton' | 'scoped' | 'transient';

export enum DiServiceType {
    /**
     * One shared instance for the whole application. Built once (eagerly on
     * `container.start()`) and returned for every resolution thereafter. Use
     * for stateless services and shared resources (config, db pool, caches).
     */
    Singleton = 'singleton',
    /**
     * One instance per request scope. Built the first time it is resolved
     * within a request and reused for the rest of that request, then disposed
     * when the request ends. Use for per-request state (the current user,
     * a unit of work, a request-scoped transaction).
     */
    Scoped = 'scoped',
    /**
     * A brand new instance on every resolution. Never cached. Use for
     * lightweight, stateful helpers that must not be shared between callers.
     */
    Transient = 'transient',
}

export interface DiService {
    service: DiServiceType;
}

export type ServiceClass = (new (
    ...args: never[]
) => object) &
    Partial<DiService>;

export interface FactoryService {
    provide: TokenLike<unknown>;
    factory: Factory<unknown>;
}

export interface ValueService {
    provide: TokenLike<unknown>;
    value: unknown;
}

export type Service = ServiceClass | FactoryService | ValueService;
