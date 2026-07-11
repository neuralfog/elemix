import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find } from '@neuralfog/elemix-testing-library/query';
import './.emited/EffectApp';

export default { title: 'Compiled/EffectApp' };

export const Default = {
    render: () => '<effect-app></effect-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = find('effect-app', canvasElement);
        if (!app) throw new Error('effect-app did not render');

        // the eager #effect ran at mount — mirrored state.count onto the host
        expect(app.getAttribute('data-count')).toBe('0');
        // the isMounted-guarded #effect skipped the mount run
        expect(app.getAttribute('data-changed')).toBe(null);

        // ...both re-run reactively when the state they read changes
        click(find('.inc', canvasElement) as HTMLButtonElement);
        expect(find('.count', canvasElement)?.textContent).toBe('1');
        expect(app.getAttribute('data-count')).toBe('1');
        expect(app.getAttribute('data-changed')).toBe('1');
    },
};
