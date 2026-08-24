import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag unknown-app
export class UnknownApp extends Component {
    template = (): Template => tpl`<user-card :naem=${'x'} :count=${1}></user-card>`;
}
