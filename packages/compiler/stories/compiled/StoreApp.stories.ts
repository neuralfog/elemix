import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/StoreApp';

export default { title: 'Compiled/StoreApp' };

export const Default = {
    render: () => '<store-app></store-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const readout = find('.readout strong', canvasElement);
        const controls = find('store-controls', canvasElement);
        if (!readout || !controls) throw new Error('store-app missing readout or child shadow root');

        const childValue = find('.value', controls);
        const childButtons = query('button', controls);
        const dec = childButtons[0];
        const inc = childButtons[1];
        if (!childValue || !dec || !inc) {
            throw new Error('store-controls missing value or buttons');
        }

        expect(dec.textContent?.trim()).toBe('−');
        expect(inc.textContent?.trim()).toBe('+');
        expect(find('.label', controls)?.textContent).toBe('Child controls');

        expect(readout.textContent).toBe('0');
        expect(childValue.textContent).toBe('0');

        click(inc);
        expect(childValue.textContent).toBe('1');
        expect(readout.textContent).toBe('1');

        click(inc);
        click(inc);
        expect(childValue.textContent).toBe('3');
        expect(readout.textContent).toBe('3');

        click(dec);
        expect(childValue.textContent).toBe('2');
        expect(readout.textContent).toBe('2');

        click(dec);
        click(dec);
        click(dec);
        expect(childValue.textContent).toBe('-1');
        expect(readout.textContent).toBe('-1');
    },
};
