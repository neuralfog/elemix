export class MockCSSStyleSheet {
    cssRules: CSSRuleMock[];

    constructor() {
        this.cssRules = [];
    }

    insertRule(rule: string, index?: number): number {
        if (typeof index === 'undefined') {
            // biome-ignore lint:
            index = this.cssRules.length;
        }

        if (index < 0 || index > this.cssRules.length) {
            throw new RangeError('Index size error');
        }

        this.cssRules.splice(index, 0, new CSSRuleMock(rule));
        return index;
    }

    deleteRule(index: number): void {
        if (index < 0 || index >= this.cssRules.length) {
            throw new RangeError('Index size error');
        }

        this.cssRules.splice(index, 1);
    }

    replaceSync(cssText: string): void {
        this.cssRules = cssText
            .split(/(?<=})\s*/)
            .filter((rule) => rule.trim())
            .map((ruleText) => new CSSRuleMock(ruleText));
    }
}

class CSSRuleMock {
    cssText: string;
    parentRule: CSSRule | null;
    parentStyleSheet: CSSStyleSheet | null;
    type: number;

    constructor(cssText: string) {
        this.cssText = cssText;
        this.parentRule = null;
        this.parentStyleSheet = null;
        this.type = CSSRule.STYLE_RULE;
    }
}
