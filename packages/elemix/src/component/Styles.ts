import type { Component } from './Component';

// One constructable stylesheet per `static styles` array (i.e. per component
// class), shared by adopting it into every instance's shadow root rather than
// rebuilding it per instance.
const sheetCache = new WeakMap<string[], CSSStyleSheet>();

export class Styles {
    public styles: string[];

    constructor(private component: Component) {
        this.styles = (this.component.constructor as any).styles || [];
    }

    public initialize(): void {
        if (this.component.shadowRoot && this.styles.length) {
            let sheet = sheetCache.get(this.styles);
            if (!sheet) {
                sheet = new CSSStyleSheet();
                sheet.replaceSync(this.styles.join(' '));
                sheetCache.set(this.styles, sheet);
            }
            this.component.shadowRoot.adoptedStyleSheets = [
                sheet,
                ...this.component.controlStyles,
            ];
        }
    }
}
