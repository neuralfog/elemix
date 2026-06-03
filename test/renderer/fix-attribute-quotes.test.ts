import { expect, test, describe, beforeEach } from 'vitest';
import { fixAttributeQuotes } from '../../src/renderer/utils';
import { html, render as renderTemplate } from '../../src/renderer/render';

describe('fixAttributeQuotes — unit cases', () => {
    test('wraps an unquoted plain value in double quotes', () => {
        expect(fixAttributeQuotes('<div id=foo></div>')).toBe(
            '<div id="foo"></div>',
        );
    });

    test('wraps an unquoted hole-marker comment', () => {
        expect(
            fixAttributeQuotes('<div data-x=<!--₥0--> data-y=z></div>'),
        ).toBe('<div data-x="<!--₥0-->" data-y="z"></div>');
    });

    test('leaves already double-quoted values untouched', () => {
        expect(fixAttributeQuotes('<div id="foo"></div>')).toBe(
            '<div id="foo"></div>',
        );
    });

    test('leaves single-quoted values untouched even when they contain inner double quotes', () => {
        // This is the failure mode the dropdown story hit: prettier rewrote
        // `data-options="...&quot;..."` to `data-options='[{"value":"pet"...}]'`.
        // The old regex matched `'[{` and stopped at the first inner `"`,
        // wrapping that fragment in double quotes and splitting the rest of
        // the JSON into garbled "attributes".
        const json =
            '<pf-dropdown data-options=\'[{"value":"pet","label":"Q"}]\'></pf-dropdown>';
        expect(fixAttributeQuotes(json)).toBe(json);
    });

    test('leaves single-quoted values containing `>` untouched', () => {
        const input = "<div data-x='a > b'></div>";
        expect(fixAttributeQuotes(input)).toBe(input);
    });

    test('does not get confused by a mix of quoted and unquoted attrs on the same tag', () => {
        expect(
            fixAttributeQuotes(
                '<pf-dropdown data-options=\'[{"k":"v"}]\' data-placeholder=Select data-size="small"></pf-dropdown>',
            ),
        ).toBe(
            '<pf-dropdown data-options=\'[{"k":"v"}]\' data-placeholder="Select" data-size="small"></pf-dropdown>',
        );
    });
});

describe('Renderer — single-quoted attributes with JSON survive end-to-end', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('a custom element receives an intact single-quoted JSON attribute', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        renderTemplate(
            html`<test-quoted-attr
                data-options='[{"value":"pet","label":"What is your pet name?"},{"value":"city","label":"In what city were you born?"}]'
            ></test-quoted-attr>`,
            container,
        );

        const el = container.querySelector('test-quoted-attr');
        expect(el).not.toBeNull();
        const raw = el?.getAttribute('data-options');
        expect(raw).toBe(
            '[{"value":"pet","label":"What is your pet name?"},{"value":"city","label":"In what city were you born?"}]',
        );
        // The attribute must JSON.parse cleanly — that's what consumers do.
        expect(JSON.parse(raw as string)).toEqual([
            { value: 'pet', label: 'What is your pet name?' },
            { value: 'city', label: 'In what city were you born?' },
        ]);
    });

    test('subsequent attributes after a single-quoted one are preserved', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        renderTemplate(
            html`<test-quoted-attr
                data-options='[{"k":"v"}]'
                data-placeholder="pick"
            ></test-quoted-attr>`,
            container,
        );

        const el = container.querySelector('test-quoted-attr');
        expect(el?.getAttribute('data-options')).toBe('[{"k":"v"}]');
        expect(el?.getAttribute('data-placeholder')).toBe('pick');
    });
});
