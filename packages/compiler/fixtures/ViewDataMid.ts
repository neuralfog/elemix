import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './ViewDataLeaf';
import type { VData } from './ViewDataApp';

// #component
export class ViewDataMid extends Component<unknown, VData> {
    template = (): Template => tpl`
        <div class="mid">
            <span class="count">${this.viewData.count}</span>
            <view-data-leaf />
        </div>
    `;
}
