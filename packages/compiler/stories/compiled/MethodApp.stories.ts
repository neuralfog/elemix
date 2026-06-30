import { expect, userEvent } from 'storybook/test';
import './.emited/MethodApp';

export default { title: 'Compiled/MethodApp' };

export const Default = {
    render: () => '<method-app></method-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('method-app');
        if (!app) throw new Error('method-app did not render');
        const root = app.shadowRoot;
        if (!root) throw new Error('method-app has no shadow root');

        // the method-form `template()` lowered to `view()` like the arrow field:
        // the non-reactive prelude const survives into its hole...
        expect(root.querySelector('.lbl')?.textContent).toBe('count');
        // ...and the reactive hole tracks state across a click.
        expect(root.querySelector('.count')?.textContent).toBe('0');
        await userEvent.click(root.querySelector('.inc') as HTMLButtonElement);
        expect(root.querySelector('.count')?.textContent).toBe('1');
    },
};
