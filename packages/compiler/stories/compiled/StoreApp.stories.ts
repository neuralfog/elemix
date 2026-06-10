import { expect, userEvent } from 'storybook/test';
import './.emited/StoreApp';

export default { title: 'Compiled/StoreApp' };

export const Default = {
    render: () => '<store-app></store-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('store-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('store-app did not render a shadow root');

        const readout = root.querySelector('.readout strong');
        const controls = root.querySelector('store-controls');
        const childRoot = controls?.shadowRoot;
        if (!readout || !childRoot) throw new Error('store-app missing readout or child shadow root');

        // child renders the shared counter object in .value; buttons order: − then +
        const childValue = childRoot.querySelector('.value');
        const childButtons = childRoot.querySelectorAll('button');
        const dec = childButtons[0];
        const inc = childButtons[1];
        if (!childValue || !dec || !inc) {
            throw new Error('store-controls missing value or buttons');
        }

        // button labels (− then +); − is the U+2212 minus sign
        expect(dec.textContent?.trim()).toBe('−');
        expect(inc.textContent?.trim()).toBe('+');
        // child renders its static label
        expect(childRoot.querySelector('.label')?.textContent).toBe('Child controls');

        // shared object starts at 0 in both parent readout and child value
        expect(readout.textContent).toBe('0');
        expect(childValue.textContent).toBe('0');

        // child mutates the shared-by-reference object — both parent + child re-render
        await userEvent.click(inc);
        expect(childValue.textContent).toBe('1');
        expect(readout.textContent).toBe('1');

        // repeated increments keep both views in sync
        await userEvent.click(inc);
        await userEvent.click(inc);
        expect(childValue.textContent).toBe('3');
        expect(readout.textContent).toBe('3');

        // − decrements the same shared object; parent readout follows
        await userEvent.click(dec);
        expect(childValue.textContent).toBe('2');
        expect(readout.textContent).toBe('2');

        // can go negative through the shared reference
        await userEvent.click(dec);
        await userEvent.click(dec);
        await userEvent.click(dec);
        expect(childValue.textContent).toBe('-1');
        expect(readout.textContent).toBe('-1');
    },
};
