import { expect, userEvent } from 'storybook/test';
import './.emited/MultiRootApp';

export default { title: 'Compiled/MultiRootApp' };

export const Default = {
    render: () => '<multi-root-app></multi-root-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('multi-root-app');
        if (!app) throw new Error('multi-root-app did not render');
        const root = app.shadowRoot;
        if (!root) throw new Error('multi-root-app has no shadow root');

        // a conditional branch with TWO root elements — both must mount
        expect(root.querySelector('.a')?.textContent).toBe('a0');
        expect(root.querySelector('.b')?.textContent).toBe('b');

        // updating state re-runs the conditional (it reads count); the SECOND
        // root must survive the re-render, not vanish
        await userEvent.click(root.querySelector('.inc') as HTMLButtonElement);
        expect(root.querySelector('.a')?.textContent).toBe('a1');
        expect(root.querySelector('.b')?.textContent).toBe('b');
    },
};
