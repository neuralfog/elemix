import { expect, userEvent } from 'storybook/test';
import './.emited/NoShadowApp';

export default { title: 'Compiled/NoShadowApp' };

export const Default = {
    // a global page rule — shadow DOM would block it, light DOM lets it through
    render: () =>
        '<style>.light { color: rgb(0, 128, 0); }</style><no-shadow-app></no-shadow-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('no-shadow-app');
        if (!app) throw new Error('no-shadow-app did not render');

        // #no-shadow → rendered into the light DOM, no shadow root
        expect(app.shadowRoot).toBe(null);
        const count = app.querySelector('.count');
        if (!count) throw new Error('content not in the light DOM');
        expect(count.textContent).toBe('0');

        // the GLOBAL stylesheet reaches the component (light DOM), so the page's
        // green wins — and the component's own #styles (red) is a skipped noop
        const light = app.querySelector('.light') as HTMLElement;
        expect(getComputedStyle(light).color).toBe('rgb(0, 128, 0)');

        // still fully reactive
        await userEvent.click(app.querySelector('.inc') as HTMLButtonElement);
        expect(count.textContent).toBe('1');
    },
};
