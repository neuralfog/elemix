import { Component, defineComponent } from '../../../src/component/Component';
import { html, type Template } from '../../../src/types';

/**
 * Reads its `data-payload` attribute in `beforeMount` and parses it as JSON.
 * If the renderer applies attribute hole values AFTER `connectedCallback`
 * fires, `getAttribute('data-payload')` will return the literal marker
 * comment string ("<!--MARKER-->") and `JSON.parse` throws.
 *
 * The fixture captures whatever parsed successfully so the test can assert
 * the attribute was already hydrated by the time `beforeMount` ran.
 */
export class AttrBeforeConnect extends Component {
    public parsed: unknown = null;
    public parseError: string | null = null;
    public rawAttr: string | null = null;

    beforeMount(): void {
        this.rawAttr = this.getAttribute('data-payload');
        if (this.rawAttr === null) return;
        try {
            this.parsed = JSON.parse(this.rawAttr);
        } catch (err) {
            this.parseError = err instanceof Error ? err.message : String(err);
        }
    }

    template = (): Template => html`<div></div>`;
}

defineComponent('attr-before-connect', AttrBeforeConnect);
