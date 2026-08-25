import { describe, expect, it } from 'bun:test';
import {
    DiContainer,
    ForbiddenDependencyError,
    Tokens,
} from '../src/container';

const REQUEST = Tokens.create<{ url: string }>('Request');

const withHttpContext = (): DiContainer => {
    const c = new DiContainer();
    c.contextTokens(
        'http',
        [REQUEST],
        'no request in a worker; pass via job args',
    );
    return c;
};

describe('noHttp scope guardrail', () => {
    it('resolves ordinary services in a noHttp scope', () => {
        const c = withHttpContext();
        class Config {}
        class Db {
            constructor(public config: Config) {}
        }
        c.singleton(Config, () => new Config());
        c.singleton(Db, (r) => new Db(r.get(Config)));

        const scope = c.scope().noHttp();
        expect(scope.get(Db)).toBeInstanceOf(Db);
        expect(scope.get(Db).config).toBeInstanceOf(Config);
    });

    it('throws when a job directly resolves a request token', () => {
        const c = withHttpContext();
        const scope = c.scope().noHttp();
        expect(() => scope.get(REQUEST)).toThrow(ForbiddenDependencyError);
    });

    it('throws with the full resolution chain for a transitive request dep', () => {
        const c = withHttpContext();
        class AuditContext {
            constructor(public req: { url: string }) {}
        }
        class Db {
            constructor(public audit: AuditContext) {}
        }
        c.scoped(AuditContext, (r) => new AuditContext(r.get(REQUEST)));
        c.scoped(Db, (r) => new Db(r.get(AuditContext)));

        const scope = c.scope().noHttp();
        let caught: unknown;
        try {
            scope.get(Db);
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(ForbiddenDependencyError);
        const err = caught as ForbiddenDependencyError;
        expect(err.context).toBe('http');
        expect(err.chain).toEqual(['Db', 'AuditContext', 'Request']);
        expect(err.message).toContain('pass via job args');
    });

    it('still resolves request tokens in an ordinary http scope', () => {
        const c = withHttpContext();
        const req = { url: '/x' };
        const scope = c.scope();
        scope.value(REQUEST, req);
        expect(scope.get(REQUEST)).toBe(req);
    });

    it('inherits the forbid into child scopes', () => {
        const c = withHttpContext();
        const job = c.scope().noHttp();
        const child = job.scope();
        expect(() => child.get(REQUEST)).toThrow(ForbiddenDependencyError);
    });

    it('leaves unrelated containers unaffected when no context is registered', () => {
        const c = new DiContainer();
        const scope = c.scope().noHttp();
        scope.value(REQUEST, { url: '/y' });
        expect(scope.get(REQUEST).url).toBe('/y');
    });
});
