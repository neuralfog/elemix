import { describe, expect, it } from 'bun:test';
import {
    CircularDependencyError,
    DiContainer,
    type Provider,
    ScopeRequiredError,
    DiServiceType,
    Tokens,
    UnboundTokenError,
} from '../src/container';

describe('value bindings', () => {
    it('returns the exact instance', () => {
        const c = new DiContainer();
        const config = { url: 'x' };
        const CONFIG = Tokens.create<{ url: string }>('Config');
        c.value(CONFIG, config);
        expect(c.get(CONFIG)).toBe(config);
    });
});

describe('singleton lifetime', () => {
    it('is lazy and cached', () => {
        const c = new DiContainer();
        let built = 0;
        class Svc {
            constructor() {
                built++;
            }
        }
        c.singleton(Svc, () => new Svc());
        expect(built).toBe(0);

        const a = c.get(Svc);
        expect(built).toBe(1);
        const b = c.get(Svc);
        expect(built).toBe(1);
        expect(a).toBe(b);
    });
});

describe('start', () => {
    it('eagerly builds singletons once on start', () => {
        const c = new DiContainer();
        let singletons = 0;
        let transients = 0;
        class Config {
            constructor() {
                singletons++;
            }
        }
        class Job {
            constructor() {
                transients++;
            }
        }
        c.singleton(Config, () => new Config());
        c.transient(Job, () => new Job());

        expect(singletons).toBe(0);
        c.start();
        expect(singletons).toBe(1);
        expect(transients).toBe(0);

        expect(c.get(Config)).toBeInstanceOf(Config);
        expect(singletons).toBe(1);
    });
});

describe('start with services', () => {
    it('registers a bare class as a singleton', () => {
        const c = new DiContainer();
        class Db {}
        c.start([Db]);
        expect(c.get(Db)).toBeInstanceOf(Db);
        expect(c.get(Db)).toBe(c.get(Db));
    });

    it('derives factory lifetime from the provided class', () => {
        const c = new DiContainer();
        class Job {
            static service = DiServiceType.Transient;
        }
        c.start([{ provide: Job, factory: () => new Job() }]);
        expect(c.get(Job)).not.toBe(c.get(Job));
    });

    it('registers value', () => {
        const c = new DiContainer();
        const CONFIG = Tokens.create<{ url: string }>('Config');
        c.start([{ provide: CONFIG, value: { url: 'x' } }]);
        expect(c.get(CONFIG).url).toBe('x');
    });

    it('registers a bare class with the lifetime it declares', () => {
        const c = new DiContainer();
        class Cache {
            static service = DiServiceType.Singleton;
        }
        class Job {
            static service = DiServiceType.Transient;
        }
        c.start([Cache, Job]);
        expect(c.get(Cache)).toBe(c.get(Cache));
        expect(c.get(Job)).not.toBe(c.get(Job));
    });

    it('auto-wires a service from its injected metadata', () => {
        const c = new DiContainer();
        class Db {
            query(): string {
                return 'data';
            }
        }
        class Repo {
            constructor(public db: Db) {}
        }
        c.start([Db, Repo]);
        expect(c.get(Repo).db.query()).toBe('data');
    });
});

describe('transient lifetime', () => {
    it('builds a new instance every resolve', () => {
        const c = new DiContainer();
        let built = 0;
        class Svc {
            constructor() {
                built++;
            }
        }
        c.transient(Svc, () => new Svc());

        const a = c.get(Svc);
        const b = c.get(Svc);
        expect(a).not.toBe(b);
        expect(built).toBe(2);
    });
});

describe('scoped lifetime', () => {
    it('caches per scope and differs across scopes', () => {
        const c = new DiContainer();
        class Req {}
        c.scoped(Req, () => new Req());

        const s1 = c.scope();
        const s2 = c.scope();
        const a = s1.get(Req);
        expect(s1.get(Req)).toBe(a);
        expect(s2.get(Req)).not.toBe(a);
    });

    it('throws when resolved on the root', () => {
        const c = new DiContainer();
        class Req {}
        c.scoped(Req, () => new Req());
        expect(() => c.get(Req)).toThrow(ScopeRequiredError);
    });

    it('resolves singletons from a scope by delegating to root', () => {
        const c = new DiContainer();
        class Db {}
        c.singleton(Db, () => new Db());
        const s = c.scope();
        expect(s.get(Db)).toBe(c.get(Db));
    });
});

describe('bind auto-wiring', () => {
    it('auto-wires a bound class from its injected metadata', () => {
        const c = new DiContainer();
        class Db {
            query() {
                return 'data';
            }
        }
        class Repo {
            constructor(public db: Db) {}
        }
        c.bind(Db);
        c.bind(Repo);

        const repo = c.get(Repo);
        expect(repo.db).toBeInstanceOf(Db);
        expect(repo.db.query()).toBe('data');
        expect(repo.db).toBe(c.get(Db));
    });

    it('defaults to singleton and honours a chosen lifetime', () => {
        const c = new DiContainer();
        class A {}
        class B {}
        c.bind(A);
        c.bind(B).transient();

        expect(c.get(A)).toBe(c.get(A));
        expect(c.get(B)).not.toBe(c.get(B));
    });
});

describe('auto-resolution', () => {
    it('resolves an unregistered concrete class as transient', () => {
        const c = new DiContainer();
        class Plain {
            hi() {
                return 'hi';
            }
        }
        const a = c.get(Plain);
        const b = c.get(Plain);
        expect(a).toBeInstanceOf(Plain);
        expect(a.hi()).toBe('hi');
        expect(a).not.toBe(b);
    });

    it('throws for an unbound interface token', () => {
        const c = new DiContainer();
        const MAILER = Tokens.create<{ send(): void }>('Mailer');
        expect(() => c.get(MAILER)).toThrow(UnboundTokenError);
    });
});

describe('interface tokens', () => {
    it('binds an implementation behind a token', () => {
        interface Mailer {
            send(): string;
        }
        const c = new DiContainer();
        const MAILER = Tokens.create<Mailer>('Mailer');
        c.singleton(MAILER, () => ({ send: () => 'sent' }));
        expect(c.get(MAILER).send()).toBe('sent');
    });
});

describe('circular dependencies', () => {
    it('throws with the chain', () => {
        const c = new DiContainer();
        class A {
            constructor(public b: unknown) {}
        }
        class B {
            constructor(public a: unknown) {}
        }
        c.singleton(A, (r) => new A(r.get(B)));
        c.singleton(B, (r) => new B(r.get(A)));
        expect(() => c.get(A)).toThrow(CircularDependencyError);
    });

    it('breaks a cycle through a provider thunk', () => {
        const c = new DiContainer();
        class A {
            constructor(public b: Provider<B>) {}
        }
        class B {
            constructor(public a: A) {}
        }
        c.singleton(A, (r) => new A(() => r.get(B)));
        c.singleton(B, (r) => new B(r.get(A)));

        const a = c.get(A);
        const b = a.b();
        expect(b).toBeInstanceOf(B);
        expect(b.a).toBe(a);
    });
});

describe('disposal', () => {
    it('disposes owned singletons newest-first', async () => {
        const c = new DiContainer();
        const order: string[] = [];
        class First {
            dispose() {
                order.push('first');
            }
        }
        class Second {
            dispose() {
                order.push('second');
            }
        }
        c.bind(First);
        c.bind(Second);
        c.get(First);
        c.get(Second);

        await c.dispose();
        expect(order).toEqual(['second', 'first']);
    });

    it('disposes scoped instances when the scope ends', async () => {
        const c = new DiContainer();
        const disposed: string[] = [];
        class ReqSvc {
            dispose() {
                disposed.push('req');
            }
        }
        c.scoped(ReqSvc, () => new ReqSvc());

        const s = c.scope();
        s.get(ReqSvc);
        await s.dispose();
        expect(disposed).toEqual(['req']);
    });
});
