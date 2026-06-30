import { expect, userEvent } from 'storybook/test';
import './.emited/CustomEventApp';

export default { title: 'Compiled/CustomEventApp' };

export const Default = {
    render: () => '<custom-event-app></custom-event-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('custom-event-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('custom-event-app has no shadow root');

        // `@ping` is a custom event - it must be wired with addEventListener, not
        // an `onping` property (which the DOM never invokes for a CustomEvent).
        expect(root.querySelector('.caught')?.textContent).toBe('0');
        await userEvent.click(root.querySelector('.fire') as HTMLButtonElement);
        expect(root.querySelector('.caught')?.textContent).toBe('1');
    },
};
