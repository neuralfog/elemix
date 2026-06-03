import { expect, test, describe, beforeEach } from 'vitest';
import { Component } from '../src/component/Component';
import { component } from '../src/decorators/component';
import { html, type Template } from '../src/types';
import { present } from '../testing';
import { render } from '../utilities';

@component()
class NoForm extends Component {
    template = (): Template => html`<span>plain</span>`;
}

@component()
class FormBasic extends Component {
    static formAssociated = true;

    public sawInternalsInBeforeMount = false;

    beforeMount(): void {
        this.sawInternalsInBeforeMount = !!this.internals;
    }

    template = (): Template => html`<span>form</span>`;
}

@component()
class FormSetsValue extends Component {
    static formAssociated = true;
    declare internals: ElementInternals;

    public internalsReadInBeforeMount = false;

    beforeMount(): void {
        // Read a property off internals — subclasses that declare
        // `formAssociated = true` should access `this.internals` directly,
        // narrowed via `declare`, with no guard / no boilerplate.
        const _form = this.internals.form;
        void _form;
        this.internalsReadInBeforeMount = true;
    }

    template = (): Template => html`<span>form-with-value</span>`;
}

describe('formAssociated auto-attach', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('non-form-associated component has no internals attached', async () => {
        const presenter = present().screen(html`<no-form></no-form>`);
        await render();
        const el = presenter.root<NoForm>();
        expect(el.internals).toBeUndefined();
    });

    test('formAssociated=true attaches internals once', async () => {
        const presenter = present().screen(html`<form-basic></form-basic>`);
        await render();
        const el = presenter.root<FormBasic>();
        expect(el.internals).toBeDefined();
    });

    test('beforeMount runs after internals attach — sees this.internals', async () => {
        const presenter = present().screen(html`<form-basic></form-basic>`);
        await render();
        const el = presenter.root<FormBasic>();
        expect(el.sawInternalsInBeforeMount).toBe(true);
    });

    test('beforeMount can use internals without a guard', async () => {
        const presenter = present().screen(
            html`<form-sets-value></form-sets-value>`,
        );
        await render();
        const el = presenter.root<FormSetsValue>();
        expect(el.internals).toBeDefined();
        // The actual contract: subclass beforeMount can dereference
        // `this.internals` without crashing.
        expect(el.internalsReadInBeforeMount).toBe(true);
    });

    test('re-connecting the element does not re-attach internals (no NotSupportedError)', async () => {
        const presenter = present().screen(html`<form-basic></form-basic>`);
        await render();
        const el = presenter.root<FormBasic>();
        const firstInternals = el.internals;
        const parent = el.parentNode as HTMLElement;
        parent.removeChild(el);
        parent.appendChild(el);
        await render();
        expect(el.internals).toBe(firstInternals);
    });
});
