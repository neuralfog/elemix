import { expect } from '@neuralfog/elemix-testing-library';
import { find } from '@neuralfog/elemix-testing-library/query';
import { click } from '@neuralfog/elemix-testing-library/events';
import './.emited/NoShadowApp';

export default { title: 'Compiled/NoShadowApp' };

export const Default = {
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

        const light = find('.light', app) as HTMLElement;
        expect(getComputedStyle(light).color).toBe('rgb(0, 128, 0)');

        click(find('.inc', app) as HTMLButtonElement);
        expect(count.textContent).toBe('1');
    },
};
