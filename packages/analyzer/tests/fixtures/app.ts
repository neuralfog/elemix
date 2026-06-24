import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag my-app
export class MyApp extends Component {
    // Two holes are wrong on purpose (name wants string, count wants number),
    // two are valid — the analyzer must flag exactly the two bad ones.
    template = (): Template => tpl`
        <user-card :name=${42} :count=${7}></user-card>
        <user-card :name=${'hi'} :count=${'nope'}></user-card>
    `;
}
