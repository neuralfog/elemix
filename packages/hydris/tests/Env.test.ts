import { afterEach, describe, expect, it } from 'bun:test';
import { env } from '../src/config/env';

const KEYS = ['H_STR', 'H_BOOL', 'H_NUM', 'H_EMPTY', 'H_LIST'];

describe('env config helpers', () => {
    afterEach(() => {
        for (const key of KEYS) delete process.env[key];
    });

    it('get returns the value or the fallback', () => {
        process.env.H_STR = 'hello';
        expect(env.get('H_STR')).toBe('hello');
        expect(env.get('H_MISSING')).toBeUndefined();
        expect(env.get('H_MISSING', 'localhost')).toBe('localhost');
    });

    it('mandatory returns a set value', () => {
        process.env.H_STR = 'db://x';
        expect(env.mandatory('H_STR')).toBe('db://x');
    });

    it('mandatory throws when missing or empty', () => {
        expect(() => env.mandatory('H_MISSING')).toThrow(
            'Missing mandatory environment variable: H_MISSING',
        );
        process.env.H_EMPTY = '';
        expect(() => env.mandatory('H_EMPTY')).toThrow();
    });

    it('boolean is true only for true/True/TRUE', () => {
        process.env.H_BOOL = 'true';
        expect(env.boolean('H_BOOL')).toBe(true);
        process.env.H_BOOL = 'TRUE';
        expect(env.boolean('H_BOOL')).toBe(true);
        process.env.H_BOOL = 'false';
        expect(env.boolean('H_BOOL')).toBe(false);
        process.env.H_BOOL = '1';
        expect(env.boolean('H_BOOL')).toBe(false);
    });

    it('boolean falls back when unset', () => {
        expect(env.boolean('H_MISSING')).toBe(false);
        expect(env.boolean('H_MISSING', true)).toBe(true);
    });

    it('number coerces and falls back when unset', () => {
        process.env.H_NUM = '8080';
        expect(env.number('H_NUM')).toBe(8080);
        expect(env.number('H_MISSING', 3000)).toBe(3000);
        expect(Number.isNaN(env.number('H_MISSING'))).toBe(true);
    });

    it('list splits on commas, trims, and drops empties', () => {
        process.env.H_LIST = 'GET, POST ,, PUT';
        expect(env.list('H_LIST')).toEqual(['GET', 'POST', 'PUT']);
    });

    it('list falls back when unset or empty', () => {
        expect(env.list('H_MISSING')).toEqual([]);
        expect(env.list('H_MISSING', ['GET'])).toEqual(['GET']);
        process.env.H_LIST = '  ,  ';
        expect(env.list('H_LIST', ['GET'])).toEqual(['GET']);
    });
});
