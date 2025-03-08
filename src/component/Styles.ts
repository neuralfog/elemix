import { App } from '../App';
import type { Component } from './Component';

export class Styles {
    public styles: string[];

    constructor(private component: Component) {
        this.styles = (this.component.constructor as any).$styles;
    }

    public initialize(): void {
        if (this.component.shadowRoot) {
            if (this.styles.length) {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(this.styles.join(' '));
                const baseStyles = App.config.baseStyles || [];
                this.component.shadowRoot.adoptedStyleSheets = [
                    ...baseStyles,
                    sheet,
                ];
            }
        }
    }
}
