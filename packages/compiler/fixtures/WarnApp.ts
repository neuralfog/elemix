import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag warnapp
export class WarnApp extends Component {
    template = (): Template => tpl`<span>hi</span>`;
}
