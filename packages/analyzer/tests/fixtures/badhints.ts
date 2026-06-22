import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// `#componnt` is a typo for `#component` — an unknown compiler hint. The class
// never registers (silent at runtime); the analyzer must flag the bad hint.
// #componnt
export class TypoHints extends Component {
    template = (): Template => tpl`<div>hi</div>`;
}
