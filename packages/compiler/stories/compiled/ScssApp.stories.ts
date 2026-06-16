import { expect, userEvent } from 'storybook/test';
import './.emited/ScssApp';

export default { title: 'Compiled/ScssApp' };

export const Default = {
    render: () => '<scss-app></scss-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('scss-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('scss-app did not render a shadow root');

        // the `.scss?inline` string was adopted as a constructable stylesheet
        expect(root.adoptedStyleSheets.length).toBeGreaterThan(0);
        const cssText = Array.from(root.adoptedStyleSheets[0].cssRules)
            .map((r) => r.cssText)
            .join('\n');

        // SASS actually compiled end to end: `--accent: #{$accent}` → `#6366f1`,
        // the nested `&:hover` flattened to `button:hover`, and no raw SASS leaked
        expect(cssText).toContain('#6366f1');
        expect(cssText).toContain('button:hover');
        expect(cssText).not.toContain('$accent');

        // the styled markup rendered and the count stays reactive
        const card = root.querySelector('.card');
        if (!card) throw new Error('scss-app missing .card');
        const button = root.querySelector('button');
        expect(button?.textContent).toContain('count is 0');
        await userEvent.click(button as HTMLButtonElement);
        expect(button?.textContent).toContain('count is 1');
    },
};
