import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import '../.emited/SignalApp';

export default { title: 'Compiled/SignalApp' };

export const Default = {
    render: () => '<signal-app></signal-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('signal-app', canvasElement);
        if (!app) throw new Error('signal-app did not render a shadow root');

        // two sibling components sharing a module store, no props between them
        const valueHost = find('signal-value', app);
        const buttonsHost = find('signal-buttons', app);
        if (!valueHost || !buttonsHost) throw new Error('signal-app missing child shadow roots');

        const value = find('.value', valueHost);
        // button order: − then Reset then +
        const childButtons = query<HTMLButtonElement>('button', buttonsHost);
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
        expect(find('.note code', app)?.textContent).toBe('state');

        // the shared module store starts at 0 (reset first in case a prior story bumped it)
        click(reset);
        expect(value.textContent).toBe('0');

        // clicking + in one component updates the number shown in the sibling
        click(inc);
        expect(value.textContent).toBe('1');
        click(inc);
        click(inc);
        expect(value.textContent).toBe('3');

        // clicking − decrements the shared store, reflected in the value sibling
        click(dec);
        expect(value.textContent).toBe('2');

        // − can take the shared store negative
        click(dec);
        click(dec);
        click(dec);
        expect(value.textContent).toBe('-1');

        // Reset zeroes the shared store
        click(reset);
        expect(value.textContent).toBe('0');

        // leave the shared module store at 0 for any later consumer
        expect(value.textContent).toBe('0');
    },
};
