import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';


// #component
export class PlainNote extends Component {
    template = (): Template => tpl`<span class="plain">plain</span>`;
}

// #component
export class TitledNote extends Component {
    heading = (): Template => tpl`<h2 class="heading">Title</h2>`;

    template = (): Template =>
        tpl`<div class="card">${this.heading()}<p class="body">body</p></div>`;
}
