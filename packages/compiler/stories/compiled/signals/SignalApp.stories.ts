import { expect, userEvent } from 'storybook/test';
import '../.emited/SignalApp';

export default { title: 'Compiled/SignalApp' };

export const Default = {
    render: () => '<signal-app></signal-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('signal-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('signal-app did not render a shadow root');

        // two sibling components sharing a module store, no props between them
        const valueRoot = root.querySelector('signal-value')?.shadowRoot;
        const buttonsRoot = root.querySelector('signal-buttons')?.shadowRoot;
        if (!valueRoot || !buttonsRoot) throw new Error('signal-app missing child shadow roots');

        const value = valueRoot.querySelector('.value');
        // button order: − then Reset then +
        const childButtons = buttonsRoot.querySelectorAll('button');
        const dec = childButtons[0];
        const reset = childButtons[1];
        const inc = childButtons[2];
        if (!value || !dec || !reset || !inc) {
            throw new Error('signal children missing value or buttons');
        }

        // button labels (− Reset +); − is the U+2212 minus sign
        expect(dec.textContent?.trim()).toBe('−');
        expect(reset.textContent?.trim()).toBe('Reset');
        expect(inc.textContent?.trim()).toBe('+');

        // the static note + code block also render in the parent shadow root
        expect(root.querySelector('.note code')?.textContent).toBe('state');

        // the shared module store starts at 0 (reset first in case a prior story bumped it)
        await userEvent.click(reset);
        expect(value.textContent).toBe('0');

        // clicking + in one component updates the number shown in the sibling
        await userEvent.click(inc);
        expect(value.textContent).toBe('1');
        await userEvent.click(inc);
        await userEvent.click(inc);
        expect(value.textContent).toBe('3');

        // clicking − decrements the shared store, reflected in the value sibling
        await userEvent.click(dec);
        expect(value.textContent).toBe('2');

        // − can take the shared store negative
        await userEvent.click(dec);
        await userEvent.click(dec);
        await userEvent.click(dec);
        expect(value.textContent).toBe('-1');

        // Reset zeroes the shared store
        await userEvent.click(reset);
        expect(value.textContent).toBe('0');

        // leave the shared module store at 0 for any later consumer
        expect(value.textContent).toBe('0');
    },
};
