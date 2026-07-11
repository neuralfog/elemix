const UI = { bubbles: true, composed: true, cancelable: true } as const;

export type TextField = HTMLInputElement | HTMLTextAreaElement;
export type ValueField = TextField | HTMLSelectElement;

export const fire = (el: EventTarget, event: Event): boolean =>
    el.dispatchEvent(event);

export const dispatch = <T = unknown>(
    el: EventTarget,
    type: string,
    init: CustomEventInit<T> = {},
): boolean => fire(el, new CustomEvent<T>(type, { ...UI, ...init }));

export const click = (el: Element, init: MouseEventInit = {}): boolean => {
    const opts = { ...UI, ...init };
    fire(el, new PointerEvent('pointerdown', opts));
    fire(el, new MouseEvent('mousedown', opts));
    fire(el, new PointerEvent('pointerup', opts));
    fire(el, new MouseEvent('mouseup', opts));
    return fire(el, new MouseEvent('click', opts));
};

export const keyDown = (
    el: EventTarget,
    key: string,
    init: KeyboardEventInit = {},
): boolean => fire(el, new KeyboardEvent('keydown', { key, ...UI, ...init }));

export const keyUp = (
    el: EventTarget,
    key: string,
    init: KeyboardEventInit = {},
): boolean => fire(el, new KeyboardEvent('keyup', { key, ...UI, ...init }));

export const press = (
    el: EventTarget,
    key: string,
    init: KeyboardEventInit = {},
): boolean => {
    keyDown(el, key, init);
    return keyUp(el, key, init);
};

export const type = (
    el: TextField,
    text: string,
    init: KeyboardEventInit = {},
): void => {
    el.focus();

    for (const char of text) {
        const key = { key: char, ...UI, ...init };

        fire(el, new KeyboardEvent('keydown', key));

        const proceed = fire(
            el,
            new InputEvent('beforeinput', {
                data: char,
                inputType: 'insertText',
                ...UI,
            }),
        );

        if (proceed) {
            el.value += char;
            fire(
                el,
                new InputEvent('input', {
                    data: char,
                    inputType: 'insertText',
                    bubbles: true,
                    composed: true,
                }),
            );
        }

        fire(el, new KeyboardEvent('keyup', key));
    }
};

export const clear = (el: TextField): void => {
    el.focus();
    el.value = '';
    fire(
        el,
        new InputEvent('input', {
            inputType: 'deleteContentBackward',
            bubbles: true,
            composed: true,
        }),
    );
};

export const setValue = (el: ValueField, value: string): void => {
    el.value = value;
    fire(el, new Event('input', { bubbles: true, composed: true }));
    fire(el, new Event('change', { bubbles: true }));
};
