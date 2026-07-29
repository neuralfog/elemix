import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

import { counter, type Seed } from './ViewDataStore';

// #component
export class ViewDataStoreApp extends Component<unknown, Seed> {
    inc = (): void => {
        counter.count++;
    };

    template = (): Template => tpl`
        <div class="store-app">
            <span class="count">${counter.count}</span>
            <button class="inc" @click=${this.inc}>+</button>
        </div>
    `;
}
