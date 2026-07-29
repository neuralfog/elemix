import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import type { VData } from './ViewDataApp';

// #component
export class ViewDataLeaf extends Component<unknown, VData> {
    template = (): Template =>
        tpl`<span class="leaf-name">${this.viewData.user.name}</span>`;
}
