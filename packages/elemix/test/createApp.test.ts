import { beforeEach, describe, expect, test } from 'vitest';
import { Component } from '../src/component/Component';
import { createApp } from '../src/createApp';
import { $__defineComponent as defineComponent } from '../src/runtime/dom';

class RootEl extends Component {}
defineComponent('root-el', RootEl);

describe('createApp', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.__elemix__ = undefined;
    });

    test('does not touch config until config() is called', () => {
        createApp(RootEl);
        createApp();
        expect(window.__elemix__).toBeUndefined();
    });

    test('config() writes onto window and returns the app for chaining', () => {
        const app = createApp();
        expect(app.config({ cloak: 'x-el{opacity:0}' })).toBe(app);
        expect(window.__elemix__?.config.cloak).toBe('x-el{opacity:0}');
    });

    test('config() merges successive patches', () => {
        createApp().config({ cloak: 'a{}' }).config({ cloak: 'b{}' });
        expect(window.__elemix__?.config.cloak).toBe('b{}');
    });

    test('mount() appends the root element into a selector target', () => {
        const host = document.createElement('div');
        host.id = 'app';
        document.body.appendChild(host);

        const app = createApp(RootEl);
        expect(app.mount('#app')).toBe(app);

        const el = host.querySelector('root-el');
        expect(el).toBeInstanceOf(RootEl);
        expect(el?.isConnected).toBe(true);
    });

    test('mount() also accepts an element target', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        createApp(RootEl).mount(host);
        expect(host.querySelector('root-el')).not.toBeNull();
    });

    test('mount() is a no-op without a root', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        expect(() => createApp().mount(host)).not.toThrow();
        expect(host.children.length).toBe(0);
    });
});
