import { Component } from '../../src/component/Component';
import { component } from '../../src/decorators/component';
import { html, type Template } from '../../src/types';

@component()
export class FirstDefinition extends Component {
    template = (): Template => html`<span>first</span>`;
}

// Manually pre-register a tag so the decorator's "already defined" guard fires
// when the class below is registered through the decorator pipeline.
const preExistingTag = 'pre-existing-tag';
if (!customElements.get(preExistingTag)) {
    class Pre extends HTMLElement {}
    customElements.define(preExistingTag, Pre);
}

@component()
export class PreExistingTag extends Component {
    template = (): Template => html`<span>second</span>`;
}
