import { Component } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { component } from '../../src/decorators/component';
import { ref } from '../../src/utilities';

@component()
export class RefApp extends Component {
    ref = ref();

    template = (): Template => {
        return html` <h1>RefApp</h1>
            <div :ref=${this.ref}>Important stuff needs a ref</div>`;
    };
}
