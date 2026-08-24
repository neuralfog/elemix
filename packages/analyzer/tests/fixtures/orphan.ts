import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component #tag orphan-app
export class OrphanApp extends Component {
    template = (): Template => tpl`<info-card :title=${'hi'}></info-card>`;
}
