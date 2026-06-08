import { expect, test, describe, beforeEach } from 'vitest';
import { html } from '../../src/renderer/render';
import { fixSelfClosing } from '../../src/renderer/utils';
import { present } from '../../testing';
import { render } from '../../utilities';
import { HTML } from '../../testing/snapshots';

import type {
    ConditionalSelfClose,
    SearchWithClear,
} from '../fixtures/renderer/SelfClosing';

import '../fixtures/renderer/SelfClosing';

describe('fixSelfClosing (preprocessor)', () => {
    test('expands self-closing custom elements into open + close pairs', () => {
        expect(fixSelfClosing('<pf-icon-close />')).toMatchSnapshot();
        expect(
            fixSelfClosing('<pf-icon-close data-x="1" />'),
        ).toMatchSnapshot();
    });

    test('preserves void HTML elements as self-closing', () => {
        expect(fixSelfClosing('<br />')).toMatchSnapshot();
        expect(fixSelfClosing('<input type="text" />')).toMatchSnapshot();
        expect(fixSelfClosing('<img src="x" />')).toMatchSnapshot();
        expect(fixSelfClosing('<hr />')).toMatchSnapshot();
    });

    test('handles attributes whose quoted values contain `>` (hole markers)', () => {
        expect(
            fixSelfClosing('<pf-icon data-x="<!--₥0-->" />'),
        ).toMatchSnapshot();
        expect(
            fixSelfClosing('<pf-icon data-x="<!--₥0-->" data-y="<!--₥1-->" />'),
        ).toMatchSnapshot();
        expect(fixSelfClosing('<pf-icon data-x="a > b" />')).toMatchSnapshot();
    });

    test('handles single-quoted attribute values', () => {
        expect(fixSelfClosing("<pf-icon data-x='a > b' />")).toMatchSnapshot();
    });

    test('does not touch tags that already have explicit close', () => {
        expect(fixSelfClosing('<div></div>')).toMatchSnapshot();
        expect(
            fixSelfClosing('<pf-icon-close></pf-icon-close>'),
        ).toMatchSnapshot();
    });

    test('expands multiple self-closing tags in a single string', () => {
        expect(
            fixSelfClosing('<pf-icon-a /><pf-icon-b /><pf-icon-c />'),
        ).toMatchSnapshot();
    });

    test('handles multi-line self-closing tags', () => {
        expect(
            fixSelfClosing(
                '<pf-icon\n    data-x="value"\n    data-y="other"\n/>',
            ),
        ).toMatchSnapshot();
    });
});

describe('Renderer Self-Closing Tags', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('sibling self-closing children render correctly', async () => {
        const presenter = present().screen(
            html`<self-closing-host></self-closing-host>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('self-closing slotted siblings reach the right slots', async () => {
        const presenter = present().screen(
            html`<self-closing-slot-host></self-closing-slot-host>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('void HTML elements remain self-closing inside templates', async () => {
        const presenter = present().screen(
            html`<void-element-host></void-element-host>`,
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot();
    });

    test('conditional template hole with self-closing tag — off / on / off', async () => {
        const presenter = present().screen(
            html`<conditional-self-close></conditional-self-close>`,
        );
        const component = presenter.getComponent<ConditionalSelfClose>(
            'conditional-self-close',
        );
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('off');

        component.showIcon = true;
        component.render();
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('on');

        component.showIcon = false;
        component.render();
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('off-again');
    });

    test('search-with-clear — empty / with-query / cleared', async () => {
        const presenter = present().screen(
            html`<search-with-clear></search-with-clear>`,
        );
        const component =
            presenter.getComponent<SearchWithClear>('search-with-clear');
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('empty');

        component.query = 'hello';
        component.render();
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('with-query');

        component.query = '';
        component.render();
        await render();
        expect(HTML(presenter.root())).toMatchSnapshot('cleared');
    });
});
