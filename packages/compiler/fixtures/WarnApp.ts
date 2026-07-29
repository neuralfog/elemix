// Diagnostic fixture: an explicit `#tag` with no hyphen. It compiles and
// registers, but `warnapp` is not a valid custom-element name, so the compiler
// inlines a `console.warn('[elemix] …')` predicting the registration failure.

import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag warnapp
export class WarnApp extends Component {
    template = (): Template => tpl`<span>hi</span>`;
}
