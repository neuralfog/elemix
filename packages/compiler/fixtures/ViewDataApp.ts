import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import './ViewDataMid';

export type VData = {
    title: string;
    user: { name: string };
    count: number;
};

// #component
export class ViewDataApp extends Component<unknown, VData> {
    template = (): Template => tpl`
        <div class="app">
            <h1 class="title">${this.viewData.title}</h1>
            <view-data-mid />
        </div>
    `;
}
