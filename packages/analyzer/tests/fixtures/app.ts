import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';
import './card';

// #component #tag my-app
export class MyApp extends Component {
    template = (): Template => tpl`
        <user-card :name=${42} :count=${7}></user-card>
        <user-card :name=${'hi'} :count=${'nope'}></user-card>
    `;
}
