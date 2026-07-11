import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/NoShadowApp';

export default { title: 'Compiled/NoShadowApp' };

export const Default = {
    // a global page rule — shadow DOM would block it, light DOM lets it through
    render: () =>
        '<style>.light { color: rgb(0, 128, 0); }</style><no-shadow-app></no-shadow-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('no-shadow-app', canvasElement);
        if (!app) throw new Error('no-shadow-app did not render');

        // #no-shadow → rendered into the light DOM, no shadow root
        expect(app.shadowRoot).toBe(null);
        const count = find('.count', app);
        if (!count) throw new Error('content not in the light DOM');
        expect(count.textContent).toBe('0');

        // the GLOBAL stylesheet reaches the component (light DOM), so the page's
        // green wins — and the component's own #styles (red) is a skipped noop
        const light = find('.light', app) as HTMLElement;
        expect(getComputedStyle(light).color).toBe('rgb(0, 128, 0)');

        // still fully reactive
        click(find('.inc', app) as HTMLButtonElement);
        expect(count.textContent).toBe('1');
    },
};
