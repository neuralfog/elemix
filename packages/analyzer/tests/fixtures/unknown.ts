import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag unknown-app
export class UnknownApp extends Component {
    // `:naem` is a typo for `:name` — on a custom element this silently does
    // nothing at runtime. The analyzer must flag it as an unknown prop.
    template = (): Template => tpl`<user-card :naem=${'x'} :count=${1}></user-card>`;
}
