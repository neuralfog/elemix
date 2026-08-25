import { afterEach, describe, expect, it } from 'bun:test';
import { Method } from '../src/constants';
import { Env } from '../src/config/Env';

const KEYS = ['H_STR', 'H_BOOL', 'H_NUM', 'H_EMPTY', 'H_LIST'];

describe('env config helpers', () => {
    afterEach(() => {
        for (const key of KEYS) delete process.env[key];
    });

    it('get returns the value or the fallback', () => {
        process.env.H_STR = 'hello';
        expect(Env.get('H_STR')).toBe('hello');
        expect(Env.get('H_MISSING')).toBeUndefined();
        expect(Env.get('H_MISSING', 'localhost')).toBe('localhost');
    });

    it('mandatory returns a set value', () => {
        process.env.H_STR = 'db://x';
        expect(Env.mandatory('H_STR')).toBe('db://x');
    });

    it('mandatory throws when missing or empty', () => {
        expect(() => Env.mandatory('H_MISSING')).toThrow(
            'Missing mandatory environment variable: H_MISSING',
        );
        process.env.H_EMPTY = '';
        expect(() => Env.mandatory('H_EMPTY')).toThrow();
    });

    it('boolean is true only for true/True/TRUE', () => {
        process.env.H_BOOL = 'true';
        expect(Env.boolean('H_BOOL')).toBe(true);
        process.env.H_BOOL = 'TRUE';
        expect(Env.boolean('H_BOOL')).toBe(true);
        process.env.H_BOOL = 'false';
        expect(Env.boolean('H_BOOL')).toBe(false);
        process.env.H_BOOL = '1';
        expect(Env.boolean('H_BOOL')).toBe(false);
    });

    it('boolean falls back when unset', () => {
        expect(Env.boolean('H_MISSING')).toBe(false);
        expect(Env.boolean('H_MISSING', true)).toBe(true);
    });

    it('number coerces and falls back when unset', () => {
        process.env.H_NUM = '8080';
        expect(Env.number('H_NUM')).toBe(8080);
        expect(Env.number('H_MISSING', 3000)).toBe(3000);
        expect(Number.isNaN(Env.number('H_MISSING'))).toBe(true);
    });

    it('list splits on commas, trims, and drops empties', () => {
        process.env.H_LIST = 'GET, POST ,, PUT';
        expect(Env.list('H_LIST')).toEqual([
            Method.Get,
            Method.Post,
            Method.Put,
        ]);
    });

    it('list falls back when unset or empty', () => {
        expect(Env.list('H_MISSING')).toEqual([]);
        expect(Env.list('H_MISSING', [Method.Get])).toEqual([Method.Get]);
        process.env.H_LIST = '  ,  ';
        expect(Env.list('H_LIST', [Method.Get])).toEqual([Method.Get]);
    });
});
