import { Component, defineComponent } from '../../src/component/Component';
import { html, type Template } from '../../src/types';

export class FirstDefinition extends Component {
    template = (): Template => html`<span>first</span>`;
}

defineComponent('first-definition', FirstDefinition);

// Manually pre-register a tag so the decorator's "already defined" guard fires
// when the class below is registered through the decorator pipeline.
const preExistingTag = 'pre-existing-tag';
if (!customElements.get(preExistingTag)) {
    class Pre extends HTMLElement {}
    customElements.define(preExistingTag, Pre);
}

export class PreExistingTag extends Component {
    template = (): Template => html`<span>second</span>`;
}

defineComponent('pre-existing-tag', PreExistingTag);
