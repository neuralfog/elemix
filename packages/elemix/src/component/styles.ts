import type { Component } from './Component';

const sheetCache = new WeakMap<string[], CSSStyleSheet>();

export const initStyles = (component: Component): void => {
    const styles =
        (component.constructor as { styles?: string[] }).styles ?? [];
    if (!component.shadowRoot || !styles.length) return;
    let sheet = sheetCache.get(styles);
    if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(styles.join(' '));
        sheetCache.set(styles, sheet);
    }
    component.shadowRoot.adoptedStyleSheets = [sheet];
};
