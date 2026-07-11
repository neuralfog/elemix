import { describe, expect, it } from 'vitest';
import { keyDown, keyUp, press } from '../src/events';

describe('keyboard events', () => {
    it('keyDown fires a real keydown carrying the key', () => {
        const el = document.createElement('input');
        let seen = '';
        el.addEventListener('keydown', (e) => {
            seen = e.key;
        });
        keyDown(el, 'Enter');
        expect(seen).toBe('Enter');
    });

    it('keyUp fires a real keyup carrying the key', () => {
        const el = document.createElement('input');
        let seen = '';
        el.addEventListener('keyup', (e) => {
            seen = e.key;
        });
        keyUp(el, 'a');
        expect(seen).toBe('a');
    });

    it('press fires keydown then keyup in order', () => {
        const el = document.createElement('input');
        const order: string[] = [];
        el.addEventListener('keydown', () => order.push('down'));
        el.addEventListener('keyup', () => order.push('up'));
        press(el, 'x');
        expect(order).toEqual(['down', 'up']);
    });

    it('bubbles and composes across a shadow boundary', () => {
        const host = document.createElement('div');
        host.attachShadow({ mode: 'open' });
        const el = document.createElement('input');
        host.shadowRoot?.appendChild(el);
        document.body.appendChild(host);
        let composed = false;
        host.addEventListener('keydown', (e) => {
            composed = e.composed;
        });
        keyDown(el, 'Enter');
        expect(composed).toBe(true);
        document.body.innerHTML = '';
    });

    it('returns whether the event was cancelled', () => {
        const el = document.createElement('input');
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
        expect(keyDown(el, 'Enter')).toBe(false);
        expect(keyDown(el, 'a')).toBe(true);
    });
});
