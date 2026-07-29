import type { DiContainer } from './DiContainer';

export abstract class ServiceProvider {
    abstract register(container: DiContainer): void;
    boot?(container: DiContainer): void;
}

export type ServiceProviderClass = new () => ServiceProvider;
