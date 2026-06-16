import { expect, userEvent } from 'storybook/test';
import './.emited/EffectApp';

export default { title: 'Compiled/EffectApp' };

export const Default = {
    render: () => '<effect-app></effect-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('effect-app');
        if (!app) throw new Error('effect-app did not render');
        const root = app.shadowRoot;
        if (!root) throw new Error('effect-app has no shadow root');

        // the eager #effect ran at mount — mirrored state.count onto the host
        expect(app.getAttribute('data-count')).toBe('0');
        // the isMounted-guarded #effect skipped the mount run
        expect(app.getAttribute('data-changed')).toBe(null);

        // ...both re-run reactively when the state they read changes
        await userEvent.click(root.querySelector('.inc') as HTMLButtonElement);
        expect(root.querySelector('.count')?.textContent).toBe('1');
        expect(app.getAttribute('data-count')).toBe('1');
        expect(app.getAttribute('data-changed')).toBe('1');
    },
};
