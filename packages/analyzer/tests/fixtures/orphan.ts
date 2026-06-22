import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// Uses <info-card> (defined in ./required) but never imports its module, so the
// custom element would never register at runtime → WARNING. The required `title`
// IS provided, so this is purely an import problem.
// #component #tag orphan-app
export class OrphanApp extends Component {
    template = (): Template => tpl`<info-card :title=${'hi'}></info-card>`;
}
