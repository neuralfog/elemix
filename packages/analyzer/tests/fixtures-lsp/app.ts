import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// A CLEAN root component: a well-typed `<user-card>` usage (name: string,
// count: number). The LSP tests edit this file's in-memory buffer to introduce
// and then fix problems; on disk it must stay valid so `didClose` reverts clean.
// #component #tag my-app
export class MyApp extends Component {
    template = (): Template =>
        tpl`<user-card :name=${'Ada'} :count=${1}></user-card>`;
}
