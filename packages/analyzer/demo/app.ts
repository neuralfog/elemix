import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

// #component
export class App extends Component {
    // #effect
    handler = 42;

    template = (): Template => tpl`
        <lone-widget :title=${99}></lone-widget>
        <button @click=${42}>go</button>
    `;
}
