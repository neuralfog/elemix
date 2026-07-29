// Diagnostic fixture: an UNKNOWN pragma directive. The compiler can't lower it,
// so it inlines a module-scope `throw new Error('[elemix] …')` — the component
// is left un-registerable, and importing the module throws loudly at load.

import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #frobnicate
export class ErrorApp extends Component {
    template = (): Template => tpl`<button>boom</button>`;
}
