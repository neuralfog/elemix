import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag hooks-app
export class HooksApp extends Component {
    // A lifecycle/effect hint can only tag a method or an arrow-function field.

    // #effect — tagging a non-function field → ERROR.
    bad = 42;

    // #effect — an arrow-function field is fine.
    good = (): void => {};

    // #mount — a normal method is fine.
    ready(): void {}

    template = (): Template => tpl`<div>hi</div>`;
}
