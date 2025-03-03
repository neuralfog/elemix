import { App } from '../App';
import type { Component } from './Component';

export class Styles {
    public styles: string[];
    public sheet?: CSSStyleSheet;

    constructor(private component: Component) {
        this.styles = (this.component.constructor as any).$styles;
    }

    public initialize(): void {
        if (
            this.component.shadowRoot &&
            !this.component.shadowRoot.adoptedStyleSheets?.length
        ) {
            if (App.config.cssReset?.length) {
                this.styles = this.prependStyles(
                    App.config.cssReset,
                    this.styles,
                );
            }

            if (this.styles.length) {
                this.sheet = new CSSStyleSheet();
                this.sheet.replaceSync(this.styles.join(' '));
                this.component.shadowRoot.adoptedStyleSheets = [this.sheet];
            }
        }
    }

    private prependStyles(value: string, array: string[]): string[] {
        const newArray = array.slice();
        newArray.unshift(value);
        return newArray;
    }
}
