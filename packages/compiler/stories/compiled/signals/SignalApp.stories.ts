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

        const valueHost = find('signal-value', app);
        const buttonsHost = find('signal-buttons', app);
        if (!valueHost || !buttonsHost) throw new Error('signal-app missing child shadow roots');

        const value = find('.value', valueHost);
        const childButtons = query<HTMLButtonElement>('button', buttonsHost);
        const dec = childButtons[0];
        const reset = childButtons[1];
        const inc = childButtons[2];
        if (!value || !dec || !reset || !inc) {
            throw new Error('signal children missing value or buttons');
        }

        expect(dec.textContent?.trim()).toBe('−');
        expect(reset.textContent?.trim()).toBe('Reset');
        expect(inc.textContent?.trim()).toBe('+');

        click(reset);
        expect(value.textContent).toBe('0');

        click(inc);
        expect(value.textContent).toBe('1');
        click(inc);
        click(inc);
        expect(value.textContent).toBe('3');

        click(dec);
        expect(value.textContent).toBe('2');

        click(dec);
        click(dec);
        click(dec);
        expect(value.textContent).toBe('-1');

        click(reset);
        expect(value.textContent).toBe('0');

        expect(value.textContent).toBe('0');
    },
};
