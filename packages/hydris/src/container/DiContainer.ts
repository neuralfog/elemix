import { type Binding, binding } from './Binding';
import {
    CircularDependencyError,
    ForbiddenDependencyError,
    ScopeRequiredError,
    UnboundTokenError,
} from './errors';
import { describe, type TokenLike } from './Token';
import {
    type BuildableLifetime,
    type Disposable,
    type Factory,
    type Service,
    type ServiceClass,
    DiServiceType,
} from './types';

const SERVICE_LIFETIME: Record<DiServiceType, BuildableLifetime> = {
    [DiServiceType.Singleton]: 'singleton',
    [DiServiceType.Scoped]: 'scoped',
    [DiServiceType.Transient]: 'transient',
};

const lifetimeOf = (declared?: DiServiceType): BuildableLifetime =>
    SERVICE_LIFETIME[declared ?? DiServiceType.Singleton];

type Registration = {
    lifetime: BuildableLifetime;
    factory: Factory<unknown>;
};

const hasDispose = (value: unknown): value is Disposable =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { dispose?: unknown }).dispose === 'function';

export class DiContainer {
    private registrations: Map<object, Registration> | null = null;
    private instances: Map<object, unknown> | null = null;
    private disposables: Disposable[] | null = null;
    private building: Set<object> | null = null;
    private forbidden: Set<string> | null = null;
    private contextByToken: Map<object, string> | null = null;
    private contextHint: Map<string, string> | null = null;
    private readonly root_: DiContainer;

    constructor(private readonly parent: DiContainer | null = null) {
        this.root_ = parent === null ? this : parent.root_;
    }

    value<T>(token: TokenLike<T>, instance: T): this {
        this.instanceMap().set(token as object, instance);
        return this;
    }

    singleton<T>(token: TokenLike<T>, factory: Factory<T>): this {
        this.register(token as object, { lifetime: 'singleton', factory });
        return this;
    }

    scoped<T>(token: TokenLike<T>, factory: Factory<T>): this {
        this.register(token as object, { lifetime: 'scoped', factory });
        return this;
    }

    transient<T>(token: TokenLike<T>, factory: Factory<T>): this {
        this.register(token as object, { lifetime: 'transient', factory });
        return this;
    }

    bind(cls: ServiceClass): Binding {
        const factory = autoFactory(cls);
        const key = cls as object;
        const set = (lifetime: BuildableLifetime): void => {
            this.register(key, { lifetime, factory });
        };
        set('singleton');
        return binding(set);
    }

    has(token: TokenLike<unknown>): boolean {
        const key = token as object;
        for (let c: DiContainer | null = this; c !== null; c = c.parent) {
            if (c.instances?.has(key) || c.registrations?.has(key)) return true;
        }
        return false;
    }

    start(services: Service[] = []): this {
        for (const service of services) this.registerService(service);
        if (this.registrations !== null) {
            for (const [token, registration] of this.registrations) {
                if (registration.lifetime === 'singleton') {
                    this.get(token as TokenLike<unknown>);
                }
            }
        }
        return this;
    }

    private registerService(service: Service): void {
        if (typeof service === 'function') {
            this.register(service as object, {
                lifetime: lifetimeOf(service.service),
                factory: autoFactory(service),
            });
            return;
        }
        if ('value' in service) {
            this.value(service.provide, service.value);
            return;
        }
        const provide = service.provide;
        const declared =
            typeof provide === 'function'
                ? (provide as ServiceClass).service
                : undefined;
        this.register(provide as object, {
            lifetime: lifetimeOf(declared),
            factory: service.factory,
        });
    }

    scope(): DiContainer {
        return new Scope(this);
    }

    contextTokens(
        name: string,
        tokens: readonly TokenLike<unknown>[],
        hint?: string,
    ): this {
        const root = this.root_;
        if (root.contextByToken === null) root.contextByToken = new Map();
        for (const t of tokens) root.contextByToken.set(t as object, name);
        if (hint !== undefined) {
            if (root.contextHint === null) root.contextHint = new Map();
            root.contextHint.set(name, hint);
        }
        return this;
    }

    forbid(name: string): this {
        if (this.forbidden === null) this.forbidden = new Set();
        this.forbidden.add(name);
        return this;
    }

    noHttp(): this {
        return this.forbid('http');
    }

    private forbids(context: string): boolean {
        for (let c: DiContainer | null = this; c !== null; c = c.parent) {
            if (c.forbidden?.has(context)) return true;
        }
        return false;
    }

    get<T>(token: TokenLike<T>): T {
        return this.resolve(token as object) as T;
    }

    dispose(): void | Promise<void> {
        this.instances?.clear();
        const disposables = this.disposables;
        if (disposables === null || disposables.length === 0) return;
        return this.disposeAll(disposables);
    }

    private async disposeAll(disposables: Disposable[]): Promise<void> {
        for (let i = disposables.length - 1; i >= 0; i--) {
            await disposables[i].dispose();
        }
        disposables.length = 0;
    }

    private resolve(key: object): unknown {
        const context = this.root_.contextByToken?.get(key);
        if (context !== undefined && this.forbids(context)) {
            const building = this.root_.building;
            const chain = building === null ? [key] : [...building, key];
            throw new ForbiddenDependencyError(
                context,
                chain.map(describe),
                this.root_.contextHint?.get(context),
            );
        }

        for (let c: DiContainer | null = this; c !== null; c = c.parent) {
            const instances = c.instances;
            if (instances?.has(key)) {
                return instances.get(key);
            }
        }

        let registration: Registration | undefined;
        for (let c: DiContainer | null = this; c !== null; c = c.parent) {
            registration = c.registrations?.get(key);
            if (registration !== undefined) break;
        }

        if (registration === undefined) {
            if (typeof key === 'function') {
                return this.runFactory(
                    key,
                    autoFactory(key as ServiceClass),
                    this,
                );
            }
            throw new UnboundTokenError(describe(key));
        }

        switch (registration.lifetime) {
            case 'singleton': {
                const root = this.root_;
                const instance = this.runFactory(
                    key,
                    registration.factory,
                    root,
                );
                root.instanceMap().set(key, instance);
                root.remember(instance);
                return instance;
            }
            case 'scoped': {
                if (this.parent === null) {
                    throw new ScopeRequiredError(describe(key));
                }
                const instance = this.runFactory(
                    key,
                    registration.factory,
                    this,
                );
                this.instanceMap().set(key, instance);
                this.remember(instance);
                return instance;
            }
            default:
                return this.runFactory(key, registration.factory, this);
        }
    }

    private runFactory(
        key: object,
        factory: Factory<unknown>,
        resolver: DiContainer,
    ): unknown {
        const building = this.root_.buildingSet();
        if (building.has(key)) {
            throw new CircularDependencyError([...building, key].map(describe));
        }
        building.add(key);
        try {
            return factory(resolver);
        } finally {
            building.delete(key);
        }
    }

    private remember(instance: unknown): void {
        if (hasDispose(instance)) this.disposableList().push(instance);
    }

    private register(key: object, registration: Registration): void {
        this.registrationMap().set(key, registration);
    }

    private registrationMap(): Map<object, Registration> {
        if (this.registrations === null) this.registrations = new Map();
        return this.registrations;
    }

    private instanceMap(): Map<object, unknown> {
        if (this.instances === null) this.instances = new Map();
        return this.instances;
    }

    private disposableList(): Disposable[] {
        if (this.disposables === null) this.disposables = [];
        return this.disposables;
    }

    private buildingSet(): Set<object> {
        if (this.building === null) this.building = new Set();
        return this.building;
    }
}

class Scope extends DiContainer {
    override singleton(): this {
        return this.denied();
    }

    override scoped(): this {
        return this.denied();
    }

    override transient(): this {
        return this.denied();
    }

    override bind(): Binding {
        return this.denied();
    }

    override start(): this {
        return this.denied();
    }

    private denied(): never {
        throw new Error(
            'Cannot register services on a request scope; register them on the root container.',
        );
    }
}

const INJECT = Symbol.for('ssr.inject');

const autoFactory =
    (cls: ServiceClass): Factory<object> =>
    (c: DiContainer): object => {
        const deps = (cls as { [INJECT]?: readonly unknown[] })[INJECT] ?? [];
        const args = deps.map((dep) => c.get(dep as TokenLike<unknown>));
        const build = cls as unknown as new (...args: unknown[]) => object;
        return new build(...args);
    };
