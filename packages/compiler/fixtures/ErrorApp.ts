import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #frobnicate
export class ErrorApp extends Component {
    template = (): Template => tpl`<button>boom</button>`;
}
