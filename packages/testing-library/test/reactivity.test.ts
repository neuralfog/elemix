import { createApp } from '@neuralfog/elemix';
import { afterEach, describe, expect, it } from 'vitest';
import { clear, click, dispatch, fire, setValue, type } from '../src/events';
import { find } from '../src/query';
import { CheckToggle } from './fixtures/CheckToggle';
import { CounterButton } from './fixtures/CounterButton';
import { GuardedInput } from './fixtures/GuardedInput';
import { KeyCounter } from './fixtures/KeyCounter';
import { ModelField } from './fixtures/ModelField';
import { NotifyBox } from './fixtures/NotifyBox';
import { SubmitForm } from './fixtures/SubmitForm';

const mount = (Comp: CustomElementConstructor): HTMLElement => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createApp(Comp).mount(host);
    return host.firstElementChild as HTMLElement;
};

const text = (root: Element, selector: string): string | undefined =>
    find(selector, root)?.textContent ?? undefined;

const el = <T extends Element = Element>(root: Element, selector: string): T =>
    find<T>(selector, root) as T;

afterEach(() => {
    document.body.innerHTML = '';
});

describe('click drives @click reactivity', () => {
    it('renders the initial reactive count', () => {
        const c = mount(CounterButton);
        expect(text(c, '.btn')).toContain('0');
    });

    it('one click increments the reactive count', () => {
        const c = mount(CounterButton);
        click(el(c, '.btn'));
        expect(text(c, '.btn')).toContain('1');
    });

    it('repeated clicks keep incrementing', () => {
        const c = mount(CounterButton);
        for (let i = 0; i < 5; i++) click(el(c, '.btn'));
        expect(text(c, '.btn')).toContain('5');
    });

    it('updates the reactive text in place, keeping the host node', () => {
        const c = mount(CounterButton);
        const btn = find('.btn', c);
        click(btn as Element);
        expect(find('.btn', c)).toBe(btn);
    });

    it('returns true when the default is not prevented', () => {
        const c = mount(CounterButton);
        expect(click(el(c, '.btn'))).toBe(true);
    });

    it('keeps separate component instances isolated', () => {
        const a = mount(CounterButton);
        const b = mount(CounterButton);
        click(el(a, '.btn'));
        expect(text(a, '.btn')).toContain('1');
        expect(text(b, '.btn')).toContain('0');
    });
});

describe('type drives ~model reactivity', () => {
    it('reflects a single character into the model and the echo', () => {
        const c = mount(ModelField);
        const input = el<HTMLInputElement>(c, '.field');
        type(input, 'A');
        expect(input.value).toBe('A');
        expect(text(c, '.echo')).toBe('A');
    });

    it('types a whole word into the model', () => {
        const c = mount(ModelField);
        type(el<HTMLInputElement>(c, '.field'), 'Ada');
        expect(text(c, '.echo')).toBe('Ada');
    });

    it('appends to the existing value across calls', () => {
        const c = mount(ModelField);
        const input = el<HTMLInputElement>(c, '.field');
        type(input, 'Ab');
        type(input, 'cd');
        expect(input.value).toBe('Abcd');
        expect(text(c, '.echo')).toBe('Abcd');
    });
});

describe('type drives @keydown and @input handlers', () => {
    it('fires keydown and input once per character, never change', () => {
        const c = mount(KeyCounter);
        type(el<HTMLInputElement>(c, '.probe'), 'abc');
        expect(text(c, '.keys')).toBe('3');
        expect(text(c, '.inputs')).toBe('3');
        expect(text(c, '.changes')).toBe('0');
    });
});

describe('type respects a cancelled beforeinput', () => {
    it('inserts nothing when @beforeinput calls preventDefault', () => {
        const c = mount(GuardedInput);
        const input = el<HTMLInputElement>(c, '.guarded');
        type(input, 'abc');
        expect(input.value).toBe('');
        expect(text(c, '.typed')).toBe('0');
    });
});

describe('clear drives ~model reactivity', () => {
    it('empties the input and the reactive echo', () => {
        const c = mount(ModelField);
        const input = el<HTMLInputElement>(c, '.field');
        type(input, 'Ada');
        clear(input);
        expect(input.value).toBe('');
        expect(text(c, '.echo')).toBe('');
    });
});

describe('setValue drives reactivity', () => {
    it('sets the whole value and updates the ~model echo', () => {
        const c = mount(ModelField);
        const input = el<HTMLInputElement>(c, '.field');
        setValue(input, 'Zoe');
        expect(input.value).toBe('Zoe');
        expect(text(c, '.echo')).toBe('Zoe');
    });

    it('replaces an existing value', () => {
        const c = mount(ModelField);
        const input = el<HTMLInputElement>(c, '.field');
        type(input, 'Ada');
        setValue(input, 'Zoe');
        expect(text(c, '.echo')).toBe('Zoe');
    });

    it('fires both input and change handlers', () => {
        const c = mount(KeyCounter);
        setValue(el<HTMLInputElement>(c, '.probe'), 'x');
        expect(text(c, '.inputs')).toBe('1');
        expect(text(c, '.changes')).toBe('1');
        expect(text(c, '.keys')).toBe('0');
    });
});

describe('click drives native default actions', () => {
    it('toggles a checkbox and drives @change reactivity', () => {
        const c = mount(CheckToggle);
        const cb = el<HTMLInputElement>(c, '.cb');
        expect(text(c, '.status')).toBe('false');
        click(cb);
        expect(cb.checked).toBe(true);
        expect(text(c, '.status')).toBe('true');
        click(cb);
        expect(cb.checked).toBe(false);
        expect(text(c, '.status')).toBe('false');
    });

    it('submits a form when its submit button is clicked', () => {
        const c = mount(SubmitForm);
        click(el(c, '.go'));
        expect(text(c, '.count')).toBe('1');
    });
});

describe('fire dispatches pre-built real events', () => {
    it('drives @submit and honours preventDefault via the return value', () => {
        const c = mount(SubmitForm);
        const form = el<HTMLFormElement>(c, '.form');
        const notCancelled = fire(
            form,
            new SubmitEvent('submit', { bubbles: true, cancelable: true }),
        );
        expect(notCancelled).toBe(false);
        expect(text(c, '.count')).toBe('1');
    });

    it('dispatches a raw custom event to an elemix handler', () => {
        const c = mount(NotifyBox);
        fire(
            el(c, '.box'),
            new CustomEvent('notify', {
                detail: 'raw',
                bubbles: true,
                composed: true,
            }),
        );
        expect(text(c, '.last')).toBe('raw');
    });
});

describe('dispatch drives @custom-event reactivity', () => {
    it('delivers a custom event with its detail', () => {
        const c = mount(NotifyBox);
        dispatch(el(c, '.box'), 'notify', { detail: 'hi' });
        expect(text(c, '.last')).toBe('hi');
    });

    it('bubbles from a descendant up to the handler', () => {
        const c = mount(NotifyBox);
        dispatch(el(c, '.last'), 'notify', { detail: 'bubbled' });
        expect(text(c, '.last')).toBe('bubbled');
    });

    it('overwrites reactively on repeated dispatch', () => {
        const c = mount(NotifyBox);
        dispatch(el(c, '.box'), 'notify', { detail: 'one' });
        dispatch(el(c, '.box'), 'notify', { detail: 'two' });
        expect(text(c, '.last')).toBe('two');
    });
});
