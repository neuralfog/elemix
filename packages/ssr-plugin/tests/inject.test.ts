import { describe, expect, it } from 'bun:test';
import { injectMetadata } from '../src/inject';

const run = (code: string): string => injectMetadata(code)?.code ?? code;

describe('injectMetadata', () => {
    it('emits inject metadata from a constructor property param', () => {
        const out = run(
            'class Db {}\nclass Repo { constructor(private db: Db) {} }',
        );
        expect(out).toContain('static [Symbol.for("ssr.inject")] = [Db]');
    });

    it('captures multiple params in order', () => {
        const out = run(
            'class Repo { constructor(private db: Db, private log: Logger) {} }',
        );
        expect(out).toContain(
            'static [Symbol.for("ssr.inject")] = [Db, Logger]',
        );
    });

    it('handles plain non-property params', () => {
        const out = run('class S { constructor(db: Db) {} }');
        expect(out).toContain('static [Symbol.for("ssr.inject")] = [Db]');
    });

    it('skips a class with no constructor', () => {
        const out = run('class Plain { hi() {} }');
        expect(out).not.toContain('ssr.inject');
    });

    it('skips a zero-arg constructor', () => {
        const out = run('class S { constructor() {} }');
        expect(out).not.toContain('ssr.inject');
    });

    it('skips when a param type is not a simple reference', () => {
        const out = run('class S { constructor(x: string) {} }');
        expect(out).not.toContain('ssr.inject');
    });

    it('handles a nested class', () => {
        const out = run(
            'function make() { return class Inner { constructor(private db: Db) {} }; }',
        );
        expect(out).toContain('static [Symbol.for("ssr.inject")] = [Db]');
    });

    it('skips a class whose param type is a type-only import', () => {
        const out = run(
            'import type { Config } from "./config";\nclass Db { constructor(private c: Config) {} }',
        );
        expect(out).not.toContain('ssr.inject');
    });

    it('skips a class whose param type is an inline type import', () => {
        const out = run(
            'import { type Config, thing } from "./config";\nclass Db { constructor(private c: Config) {} }',
        );
        expect(out).not.toContain('ssr.inject');
    });

    it('skips a class whose param type is a local interface', () => {
        const out = run(
            'interface Config { url: string }\nclass Db { constructor(private c: Config) {} }',
        );
        expect(out).not.toContain('ssr.inject');
    });

    it('still injects when the param type is a value import', () => {
        const out = run(
            'import { Db } from "./db";\nclass Repo { constructor(private db: Db) {} }',
        );
        expect(out).toContain('static [Symbol.for("ssr.inject")] = [Db]');
    });

    it('emits method injection metadata', () => {
        const out = run(
            'import { Request } from "x";\nimport { Svc } from "y";\nclass H { show(req: Request, svc: Svc) {} }',
        );
        expect(out).toContain(
            'static [Symbol.for("ssr.inject.methods")] = { show: [Request, Svc] }',
        );
    });

    it('emits both constructor and method metadata', () => {
        const out = run(
            'import { Db } from "x";\nimport { Request } from "y";\nclass H { constructor(private db: Db) {} show(req: Request) {} }',
        );
        expect(out).toContain('static [Symbol.for("ssr.inject")] = [Db]');
        expect(out).toContain(
            'static [Symbol.for("ssr.inject.methods")] = { show: [Request] }',
        );
    });

    it('skips a method whose param type is type-only', () => {
        const out = run(
            'import type { Ctx } from "x";\nclass H { show(c: Ctx) {} }',
        );
        expect(out).not.toContain('ssr.inject.methods');
    });

    it('skips zero-arg methods', () => {
        const out = run('class H { index() { return 1; } }');
        expect(out).not.toContain('ssr.inject');
    });

    it('returns null when nothing changed', () => {
        expect(injectMetadata('const x = 1;')).toBeNull();
    });
});
