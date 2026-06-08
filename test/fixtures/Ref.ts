import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';
import { ref } from '../../src/utilities';

export class RefApp extends Component {
    ref = ref();

    template = (): Template => {
        return html` <h1>RefApp</h1>
            <div :ref=${this.ref}>Important stuff needs a ref</div>`;
    };
}

defineComponent('ref-app', RefApp);
